const {downloadImage, formatPubDate, stripExtras} = require('./utils.js')
const http = require('http')
const fs = require('fs')
const axios = require('axios')
const {JSDOM} = require('jsdom')
const WPAPI = require('wpapi/superagent')
const parseString = require('xml2js').parseStringPromise

let xpost = {
    getArticle: async (url) => {
        return await axios.get(url).then((response) => {
            const dom = new JSDOM(response.data)
            const title = dom.window.document.querySelector('title').textContent
            const heroImage = dom.window.document.querySelector(xpost.opts.featuredImageSelector).src
            const body = stripExtras(dom.window.document.querySelector(xpost.opts.postBodySelector).innerHTML)
            const trimmedBody = body.split(' ').slice(0, xpost.opts.excerptWordCount).join(' ').replace(/,$/, '') + '...'
            return {
                title,
                heroImage,
                body: trimmedBody,
            }
        })
    },
    getPostsData: async () => {
        let postsData = []
        await axios.get(xpost.sourceURL).then(async (response) => {
            return await parseString(response.data)
        }).then(async (data) => {
            let items = data.rss.channel[0].item
            items = items.filter(item => new Date(item['pubDate']).getTime() > new Date(xpost.lastRun).getTime())
            for (const post of items) {
                let info = await xpost.getArticle(post.link[0])
                const description = (post['description'] + '').split("[...]</p>\n")[1]
                const pubDate = post['pubDate']
                const categories = post['category']
                const author = post['dc:creator'][0]
                const postId = post['guid'][0]['_'].split('=')[1]
                info = {postId, pubDate, author, ...info, description, categories}
                postsData.push(info)
            }
        }).catch((e) => {
            console.log(e)
        })
        return postsData
    },
    createBody: async (info) => {
        const body =
            `<div class="excerpt">${info['body']}</div><br>` +
            `<div class="bottomdesc">${info['description']}</div></div>` +
            `<style>.bottomdesc a { font-weight: bold; text-decoration: underline;}</style>`
        return body
    },
    createPost: async (info) => {
        const content = xpost.createBody(info)
        let postObject = {
            date: formatPubDate(new Date(info['pubDate'])),
            title: `${info['title']}`,
            tags: xopts.opts.tags,
            content,
            categories: xopts.opts.categories,
            status: xopts.opts.postStatus
        }

        const author = wpusers.find(f => f.name === info['author'])
        if (author) {
            postObject.author = author
        } else if (xopts.opts.authorID) {
            postObject.author = authorID
        }

        await wp.posts().create(postObject)
            .then(async (post) => {
                let filename = 'images/' + info.heroImage.split('/').pop()
                await xpost.downloadImage(info.heroImage, filename)
                    .then(async () => {
                        await wp.media().file(filename).create({
                            title: info.title,
                            post: post.id
                        }).then(async (media) => {
                            await wp.posts().id(post.id).update({
                                featured_media: media.id
                            });
                            await fs.promises.unlink(filename)
                        }).catch((err) => {
                            console.error(err)
                        });
                    });

                let message = `#${post.id}\t${post.link}\t${info['title']}`
                if (xpost.webhookURL) {
                    await axios.post(xpost.webhookURL, {
                        "username": "✖bot",
                        "unfurl_links": true,
                        "text": `✖posted ${info.postId} -> ${post.id}\n${post.link}`
                    })
                }
                console.log(message)
            }).catch((err) => {
                console.error(err)
            })
    },
    initWP: async ({endpoint, username, password}) => {
        const wp = new WPAPI({endpoint, username, password})
        xpost.wpcats = await wp.categories().perPage(100).get().then((cats) => {
            return cats.map(({id, name, slug}) => {
                return {id, name, slug}
            })
        })
        xpost.wpusers = await wp.users().perPage(100).get().then((users) => {
            return users.map(({id, name, slug}) => {
                return {id, name, slug}
            })
        })
        return wp
    },
    go: (opts) => {
        xpost.opts = opts
        xpost.webhookURL = opts.webhookURL
        xpost.sourceURL = opts.sourceURL
        xpost.lastRun = fs.readFileSync('lastrun.txt', {encoding: 'utf8', flag: 'r'}),
            console.log(`BEGIN @ ${new Date().toUTCString()}`)
        console.log(`Last run: ${new Date(xpost.lastRun).toUTCString()}`)
        xpost.initWP(opts).then(async (wp) => {
            await xpost.getPostsData()
                .then(async (posts) => {
                    for (const info of posts)
                        await xpost.createPost(info)
                })
                .catch((err) => {
                    console.error(err)
                })
            fs.writeFileSync(opts.lastRunFile, `${new Date().toUTCString()}`, {encoding: "utf8", flag: "w",})
            console.log(`FINISHED @ ${new Date().toUTCString()}`)
        }).catch((err) => {
            console.error(err)
        })
    }
}

module.exports = xpost

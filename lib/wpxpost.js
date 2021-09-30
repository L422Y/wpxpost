const {downloadImage, formatPubDate, stripExtras} = require('./utils.js')
const http = require('http')
const fs = require('fs')
const axios = require('axios')
const {JSDOM} = require('jsdom')
const WPAPI = require('wpapi/superagent')
const parseString = require('xml2js').parseStringPromise

let wpxpost = {
    getArticle: async (url) => {
        return await axios.get(url).then((response) => {
            const dom = new JSDOM(response.data)
            const title = dom.window.document.querySelector('title').textContent
            const heroImage = dom.window.document.querySelector(wpxpost.opts.featuredImageSelector).src
            const body = stripExtras(dom.window.document.querySelector(wpxpost.opts.postBodySelector).innerHTML)
            const trimmedBody = body.split(' ').slice(0, wpxpost.opts.excerptWordCount).join(' ').replace(/,$/, '') + '...'
            return {
                title,
                heroImage,
                body: trimmedBody,
            }
        })
    },
    getPostsData: async () => {
        let postsData = []
        await axios.get(wpxpost.sourceURL).then(async (response) => {
            return await parseString(response.data)
        }).then(async (data) => {
            let items = data.rss.channel[0].item
            items = items.filter(item => new Date(item['pubDate']).getTime() > new Date(wpxpost.lastRun).getTime())
            for (const post of items) {
                let info = await wpxpost.getArticle(post.link[0])
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
        const content = wpxpost.createBody(info)
        let postObject = {
            date: formatPubDate(new Date(info['pubDate'])),
            title: `${info['title']}`,
            tags: wpxpost.opts.tags,
            content,
            categories: wpxpost.opts.categories,
            status: wpxpost.opts.postStatus
        }

        const author = wpusers.find(f => f.name === info['author'])
        if (author) {
            postObject.author = author
        } else if (wpxpost.opts.authorID) {
            postObject.author = authorID
        }

        await wp.posts().create(postObject)
            .then(async (post) => {
                let filename = 'images/' + info.heroImage.split('/').pop()
                await wpxpost.downloadImage(info.heroImage, filename)
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
                if (wpxpost.webhookURL) {
                    await axios.post(wpxpost.webhookURL, {
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
        wpxpost.wpcats = await wp.categories().perPage(100).get().then((cats) => {
            return cats.map(({id, name, slug}) => {
                return {id, name, slug}
            })
        })
        wpxpost.wpusers = await wp.users().perPage(100).get().then((users) => {
            return users.map(({id, name, slug}) => {
                return {id, name, slug}
            })
        })
        return wp
    },
    go: (opts) => {
        wpxpost.opts = opts
        wpxpost.webhookURL = opts.webhookURL
        wpxpost.sourceURL = opts.sourceURL
        wpxpost.lastRun = fs.existsSync('lastrun.txt') ?
            fs.readFileSync('lastrun.txt', {encoding: 'utf8', flag: 'r'}) : "Fri, 31 Dec 1979 00:00:00 GMT"
        console.log(`BEGIN @ ${new Date().toUTCString()}`)
        console.log(`Last run: ${new Date(wpxpost.lastRun).toUTCString()}`)
        wpxpost.initWP(opts).then(async (wp) => {
            await wpxpost.getPostsData()
                .then(async (posts) => {
                    for (const info of posts)
                        await wpxpost.createPost(info)
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

module.exports = wpxpost

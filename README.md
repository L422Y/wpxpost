# wpxpost

cross-posting script for RSS to a wordpress installation

1) grab articles from an RSS feed
2) grab content and featured image from full articles using selectors
3) try and match author to original author ('dc:creator') to author on new wordpress site (great if you are cross-posting between two sites with the same authors)
4) create new article on destination wordpress site with:
   1) same author (if possible) or specified author id
   2) same publish date
   3) stripped down excerpt of original post body
   4) link to original content
   5) specified categories and tags

## installation
you can either clone this repository, or use **wpxpost** as a module 
in your nodejs script by using npm or yarn to add it to your project

``
npm i --save wpxpost
``
or
`
yarn add wpxpost
`

## usage

```
wpxpost.go({
    endpoint: <destination wordpress wp-json endpoint url>,
    username: <destination wordpress username>,
    password: <destination wordpress password>,
    webhookURL: <slack webhook url (optional)>,
    sourceURL: <source RSS feed url>,
    lastRunFile: <filename to store last run>,
    featuredImageSelector: <css selector to find primary img>,
    postBodySelector: <css selector for primary content>,
    excerptWordCount: <# of words to use in the excerpt>,
    /** wordpress options **/
    postStatus: "draft", // draft, private, publish
    tags: [214], // array of wp tag ids
    categories: [1], // array of wp category ids
    authorID: 38 // wp author id
})
```

## customization
if we like, we can override some methods, but we'll have to bring in some modules
```
const axios = require('axios')
const {JSDOM} = require('jsdom')
const {stripExtras} = require('./lib/utils.js')
```


then we can change how we get the post details
```
wpxpost.getArticle = async (url) => {
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
}
```
...or change how we build the post content
```
wpxpost.createBody = async (info) => {
    const body =
        `<div class="excerpt">${info['body']}</div><br>` +
        `<div class="bottomdesc">${info['description']}</div></div>` +
        `<style>.bottomdesc a { font-weight: bold; text-decoration: underline;}</style>`
    return body
}
```

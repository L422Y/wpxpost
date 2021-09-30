const fs = require('fs')
const configFile = fs.existsSync('.env.dev') ? '.env.dev' : '.env'
require('dotenv').config({path: configFile})

const xpost = require('./lib/xpost')

xpost.go({
    endpoint: process.env.WP_ENDPOINT,
    username: process.env.WP_USERNAME,
    password: process.env.WP_PASSWORD,
    webhookURL: process.env.SLACK_WEBHOOK_URL,
    sourceURL: process.env.SOURCE_RSS_URL,
    lastRunFile: "lastrun.txt",
    featuredImageSelector: ".article--hero img",
    postBodySelector: "div.content-body",
    excerptWordCount: 150,
    /** wordpress options **/
    postStatus: "draft",
    tags: [214],
    categories: [1],
    authorID: 38
})

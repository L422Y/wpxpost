const axios = require('axios')
const fs = require('fs')

const utils = {
    stripExtras(text) {
        return text
            .replace(/<script(?:(?!\/\/)(?!\/\*)[^'"]|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/.*(?:\n)|\/\*(?:(?:.|\s))*?\*\/)*?<\/script>/gi, ' ')
            .replace(/<div(?:(?!\/\/)(?!\/\*)[^'"]|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/.*(?:\n)|\/\*(?:(?:.|\s))*?\*\/)*?<\/div>/gi, ' ')
            .replace(/<figure(?:(?!\/\/)(?!\/\*)[^'"]|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/.*(?:\n)|\/\*(?:(?:.|\s))*?\*\/)*?<\/figure>/gi, ' ')
            .replace(/<iframe(?:(?!\/\/)(?!\/\*)[^'"]|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/.*(?:\n)|\/\*(?:(?:.|\s))*?\*\/)*?<\/iframe>/gi, ' ')
    },
    zeroPad(s) {
        s = s + ''
        var z = 2 - s.length + 1;
        z = z > 1 ? Array(z).join('0') : '';
        return (z + s);
    },
    formatPubDate(date) {
        let year = date.getFullYear();
        let month = date.getMonth() + 1;
        let day = date.getDate();
        let hours = date.getHours();
        let minutes = date.getMinutes();
        let seconds = date.getSeconds();

        return year + "-" + utils.zeroPad(month) + "-" + utils.zeroPad(day) + " " +
            utils.zeroPad(hours) + ":" + utils.zeroPad(minutes) + ":" + utils.zeroPad(seconds)
    },
    async downloadImage(url, dest) {
        return new Promise((resolve) => {
            axios({
                method: "get",
                url: url,
                responseType: "stream"
            }).then(async (response) => {
                let stream = fs.createWriteStream(dest)
                response.data.pipe(stream)
                stream.on('finish', resolve);
            }).catch((err) => {
                console.error(err)
            })
        });
    }
}
module.exports = utils

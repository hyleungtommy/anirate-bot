var axios = require("axios");
var snoowrap = require("snoowrap");
var jsdom = require("jsdom");
var fs = require("fs");
const jikan = require('@mateoaranda/jikanjs');
const { JSDOM } = jsdom;

const r = new snoowrap({
    userAgent: '123',
    clientId: '_ZmrqmbVvJ3NuwOwHh3rYA',
    clientSecret: 'bYrSvEhVOSUkBMg7ojK7yH3W7PU8sw',
    username: 'Holiday_Employee_442',
    password: 'Dor@emon123'
});

var years = [2022];
var seasons = ['winter', 'spring', 'summer', 'fall']
var seasonList = [];
var filteredList = [];
var outputList = new Map();

var selectedSeason = 0
var selectedYear = 0
var cannotFoundList = []

loadSeasonListFromJikan(1, selectedYear, selectedSeason).then(() => {
    console.log(filteredList.length + " animes found for the season")
    filteredList.forEach(element => {
        //console.log(element.title + " type=" + element.type + " season=" + element.season)
        //console.log(element)

        // if it is not an ongoing anime and long series (e.g. one piece)
        if (element.episodes != null && element.episodes <= 26) {
            searchReddit(element.title, element.episodes, element)
        }
    })

    //write result to .json
    console.log('generate result in 30 second...');
    setTimeout(() => {
        let data = JSON.stringify(Array.from(outputList.values()));
        let failData = JSON.stringify(Array.from(cannotFoundList.values()));
        fs.writeFile(years[selectedYear] + seasons[selectedSeason] + 'episode_rate_' + Date.now() + ".json", data, () => { })
        fs.writeFile(years[selectedYear] + seasons[selectedSeason] + 'search_fail_' + Date.now() + ".json", failData, () => { })
    }, 30000)


})


//search subreddit r/anime using format "anime_title Episode X discussion"
async function searchReddit(title, episode, malData) {
    console.log("search string=" + title + " Episode " + episode + " discussion")
    r.getSubreddit("anime").search({ query: title + " Episode " + episode + " discussion", sort: "relevance" }).then((list) => {

        //reddit sometime doesn't put most relevant episode at the top, so we manually search for the last episode
        var slicedList = list.slice(0, episode)
        var lastEpisodePost = slicedList.filter((post) => {
            return post.title.indexOf(("Episode " + episode + " discussion")) > 0
        })[0]
        /*
        var bestComments = []
        for (let post of slicedList) {
            if (post.title.indexOf(("Episode ")) > 0) {
                let bestComment = ""
                let bestUps = 0
                post.expandReplies({limit:1, depth:1}).then((p)=>{
                    p.comments.forEach((c) => {
                        if (c.ups > bestUps) {
                            bestComment = c
                            bestUps = c.ups
                        }
                    })
                    bestComments.push({ title: post.title.slice(post.title.indexOf(("Episode ") + 8),post.title.indexOf(("Episode ") + 9)), comment: bestComment })
                })
                
            }
        }
        */
        //compare the reddit post's MAL link with passed in mal data
        if (lastEpisodePost && lastEpisodePost.selftext_html.indexOf("https://myanimelist.net/anime/") > -1) {
            let malNo = lastEpisodePost.selftext_html.slice(lastEpisodePost.selftext_html.indexOf("https://myanimelist.net/anime/") + 30, lastEpisodePost.selftext_html.indexOf("https://myanimelist.net/anime/") + 35)
            if (malNo == malData.id) {
                getAnimeInfoFromPost(lastEpisodePost.selftext_html, malData)
            } else {
                console.log(`Title Mismatch, MAL id = ${malData.id} mal id from reddit = ${malNo} anime=${malData.title}`)
                cannotFoundList.push({ MAL: title, reddit: lastEpisodePost.title, failedOn: "title mismatch", year: years[selectedYear], season: seasons[selectedSeason] })
            }
        } else {
            console.log("cannot find post " + title + " Episode " + episode + " discussion")
            cannotFoundList.push({ MAL: title, failedOn: "not found on reddit", year: years[selectedYear], season: seasons[selectedSeason] })
        }

    })
}

//load the seasonal list from MAL with page, yearId and seasonId
async function loadSeasonListFromJikan(page, yearId, seasonId) {
    console.log("yearId=" + years[yearId] + " seasonId=" + seasons[seasonId] + " page=" + page);

    var pageData = await jikan.loadSeason(years[yearId], seasons[seasonId], page);
    seasonList = [...seasonList, ...pageData.data];

    //if there is another page, keep loading until last page is reached
    if (pageData.pagination.has_next_page) {
        page++;
        await loadMorePage(page, pageData.pagination.has_next_page, yearId, seasonId, 0)
    }

    filteredList = filterSeries(seasons[seasonId])

    return;
}

//load extra pages from MAL
async function loadMorePage(page, hasNextPage, yearId, seasonId, count) {
    if (!hasNextPage || count === 5) {// count is to prevent loading too fast to cause MAL server refuse the request
        return
    }

    var pageData = await jikan.loadSeason(years[yearId], seasons[seasonId], page);
    seasonList = [...seasonList, ...pageData.data];
    page++;

    await loadMorePage(page, pageData.pagination.has_next_page, yearId, seasonId, count + 1);
}

//filter out unpopular series and series that is not a TV show, as well as anime that is not the current season
//format the result after filtering
function filterSeries(season) {
    var filteredList = seasonList
        .filter((anime) => {
            return anime.type === 'TV' && anime.members > 10000 && anime.season === season
        })
        .map((anime) => {
            return {
                id: anime.mal_id,
                title: anime.title,
                episodes: (anime.episodes == null ? 0 : anime.episodes),
                totalScore: (anime.score == null ? 0 : anime.score),
                members: (anime.members == null ? 0 : anime.members),
                type: anime.type,
                score: anime.score,
                status: anime.status,
                season: anime.season,
                year: anime.year,
                synopsis: (anime.synopsis == null ? "No synopsis available" : anime.synopsis),
                img: anime.images.jpg.image_url,
                searchTitle: anime.title.toLowerCase(),
            }
        })
    return filteredList;
}

async function getAnimeInfoFromPost(selftext_html, anime) {
    const dom = new JSDOM(selftext_html);
    let header = dom.window.document.querySelector(".md p").firstChild.innerHTML;
    // only fill in first post data (must be latest), could have error if first post contains different rating then the previous posts
    if (!outputList.has(header)) {
        var scoreMap = {
            name: header,
            episodes: [],
            malData: anime
        };
        outputList.set(header, scoreMap);
        let trs = dom.window.document.querySelectorAll("tbody tr");
        var count = 0;
        //get first column (ep 1 - 13)
        for (var tr of trs) {
            await extractEpisodeAndScoreFromTable(tr, scoreMap, trs.length, "td:first-child", "td:nth-child(3) a", count)
            count++;
        }
        //get second column (ep 14 - 26)
        count = 0;
        for (var tr of trs) {
            if (tr.querySelector("td:nth-child(4)") != null && tr.querySelector("td:nth-child(4)").innerHTML.length > 0) {
                await extractEpisodeAndScoreFromTable(tr, scoreMap, trs.length, "td:nth-child(4)", "td:nth-child(6) a", count - 2)
            }
            count++;
        }
    }

}

async function extractEpisodeAndScoreFromTable(tr, scoreMap, trsLength, episodeSelector, scoreSelector, count) {
    let episode = tr.querySelector(episodeSelector).innerHTML;
    try {
        let score = tr.querySelector(scoreSelector).innerHTML;
        if (score === '----' || score === '-') {
            //only get poll me for the last entry
            if (count == trsLength - 1) {
                let pollmeLink = tr.querySelector(scoreSelector).getAttribute("href");
                var totalScore = await getPollmeData(pollmeLink);
                //console.log("totalScore of " + header + "=" + totalScore)
                scoreMap.episodes.push({
                    episode: episode,
                    score: totalScore
                });
            } else {
                scoreMap.episodes.push({
                    episode: episode,
                    score: 0
                });
            }

        } else {
            scoreMap.episodes.push({
                episode: episode,
                score: Number.parseFloat(score)
            });
        }
    } catch (e) {
        scoreMap.episodes.push({
            episode: episode,
            score: 0
        });
    }
}

//get score of last episode from poll.me
async function getPollmeData(pollMeLink) {
    //console.log('get pollme link ' + pollMeLink );
    return axios.get(pollMeLink).then((u) => {
        const dom = new JSDOM(u.data);
        var scoreHtmlList = dom.window.document.querySelectorAll('.basic-option-percent');
        var totalScore = 0;
        if (scoreHtmlList.length == 5) {
            totalScore = Number.parseFloat(scoreHtmlList[0].innerHTML) * 0.05 +
                Number.parseFloat(scoreHtmlList[1].innerHTML) * 0.04 +
                Number.parseFloat(scoreHtmlList[2].innerHTML) * 0.03 +
                Number.parseFloat(scoreHtmlList[3].innerHTML) * 0.02 +
                Number.parseFloat(scoreHtmlList[4].innerHTML) * 0.01;
        }
        return Math.round(totalScore * 100) / 100;
    });
}
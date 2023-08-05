const db = require('./dynamoClient');
const jikan = require('@mateoaranda/jikanjs');
const fs = require('fs');
const AWS = require("aws-sdk");

readFromFile("2022winterepisode_rate_1691201041055.json")
async function readFromFile(name){
    fs.readFile(name,'utf-8',(err,data)=>{
        var parsedData = JSON.parse(data);
        uploadToAWS(parsedData);
    });
}

async function uploadToAWS(parsedData){
    //const marshelled = AWS.DynamoDB.Converter.marshall({uploadList})
    //var convert = uploadList[0].episodeRating;
    //uploadList[0].episodeRating = AWS.DynamoDB.Converter.marshall({convert})
    console.log("upload len=" + parsedData.length)
    for(let anime of parsedData){
        console.log("uploading " + anime.malData.title)
        let episodeRating = anime.episodes;
        let convert = AWS.DynamoDB.Converter.marshall({episodeRating})
        let data = {
            'id' : {N: anime.malData.id + ""},
            'title' : {S: anime.malData.title},
            'episodes':{N : anime.malData.episodes + ""},
            'totalScore':{N: anime.malData.totalScore + ""},
            'members': {N: anime.malData.members + ""},
            'synopis': {S: anime.malData.synopsis},
            'season': {S: anime.malData.season},
            'year': {N: anime.malData.year + ""},
            'img': {S: anime.malData.img},
            'searchTitle': {S: anime.malData.searchTitle},
            'episodeRating': convert.episodeRating,
        }
        let params = {
            "TableName":"Anime",
            "Item":data
        }
        try{
            //console.log(params);
            db.putItem(params,(err,data)=>{
                if(err) {console.log("err" + err);
                console.log(params)}; 
            });
        }catch(err){
            console.log("err" + err)
            console.log(err);
        }
    }
}
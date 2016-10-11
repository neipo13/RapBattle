/*
RapBattleBot
Reads mentions in real time and responds with a rap lyric rhyming with the last word of that mention.
Uses Twit module to read mentions in real time.
Uses express to keep app running on Nodejitsu.
Uses Wordnik api to gather rhyming words.
*/

var config = require('./config');
var phrases = require('./phrases');
var Twit = require('twit');
var APIkey = config.wordnik_api_key;//insert your Wordnik key here
var restclient = require('restler');
var _ = require('lodash');


//insert your twitter api keys here
var T = new Twit({
    consumer_key: config.twitter_consumer_key
  , consumer_secret: config.twitter_consumer_secret
  , access_token: config.twitter_access_token
  , access_token_secret: config.twitter_access_secret
})

//Log that the program is running
console.log(config.twitter_handle + ': Running.');

//fill the blacklist with words that aren't allowed
console.log('Filling blacklist');
var blacklist = phrases.badwords;

//fill arrays of strings with the appropriate part of speech rap lyric on startup
console.log('Filling rap lyrics');
var nouns = phrases.nouns;
var adjectives = phrases.adjectives;
var adverbs = phrases.adverbs;
var verbTransitives = phrases.verbs;
var properNouns = phrases.properNouns;

//open twitter stream using twit
var stream = T.stream('statuses/filter', { track: ['@' + config.twitter_handle] } );
console.log('Stream Open');

//if you recieve a mention, first retweet then respond
stream.on('tweet', function (tweet) {
    if (tweet.user.screen_name != config.twitter_handle) {
        T.post('statuses/retweet/' + tweet.id_str, {}, function (error, response) {
            if (response) {
                console.log('Success! Check your bot, it should have retweeted something.')
            }
            else if (error) {
                console.log('Error retweeting :(');
            }
        });
        //reply with your line
        rap(tweet);
    }
});

//response to a mention
//mention is a json object with text being a string of the entire tweet
function rap(mention) {
    var tweet = "";//the response
    tweet += ".@" + mention.user.screen_name + " ";
    var text = mention.text;
    var words = text.split(" ");
    //grab the last word
    var position = (words.length - 1);
    var last = words[position];
    //ignore the last word and go one previous if the last word is a mention or hastag as people often throw these in after their actual lyric
    while((last.indexOf('#') != -1 || last.indexOf('@') != -1 ) && position > 0) {
        position -= 1;
        last = words[position];
    }
    //ignore any special characters, if there are any, move to one word previous
    if (/^[a-zA-Z0-9- ]*$/.test(last) == false) {
        last = last.substring(0, last.length - 1);
    }
    //log the word to rhyme
    console.log("Last word of tweet:", last);
    //seach wordnik for a word matching the variable 'last'. If there is no word it will still return an object with the id matching the word you input
    var word = last;
    console.log("Word matched by wordnik:", word);

    //uses restclient and Wordnik to grab a set of rhyming words
    var rhymeURL = 'http://api.wordnik.com:80/v4/word.json/' + word + '/relatedWords?useCanonical=false&relationshipTypes=rhyme&limitPerRelationshipType=30&api_key=' + APIkey;
    var rhyme;
    //when the json object is returned
    restclient.json(rhymeURL).on('complete', function (data)
    {
        //If there is no rhyming words, give canned response
        if (data == 'undefined' || data.length < 1)
        {
            tweet += word;
            tweet += "? I thought you wanted to rhyme.\nComeback with something better or quit wasting my time.";
            console.log("Tweet:", tweet);
            //tweet the finished product and log it as well
            T.post('statuses/update', { status: tweet, in_reply_to_status_id: mention.id_str }, function (err, reply)
            {
                console.log("error with updating status: " + err);
            });
        }
        //otherwise grab a random word from the list of rhyming matches
        else
        {
            rhyme = data[0].words[RandomRange(0, data[0].words.length - 1)];
            console.log("Rhyming word:", rhyme);
            //check the part of speech of the rhyming word
            var posURL = 'http://api.wordnik.com:80/v4/word.json/' + rhyme + '/definitions?limit=200&includeRelated=true&sourceDictionaries=all&useCanonical=false&includeTags=false&api_key=' + APIkey;
            restclient.json(posURL).on('complete', function (data2)
            {
                try {
                    //if it does not 'have' a part of speech, assume it is a noun
                    if (data2 == 'undefined' || data2.length < 2)
                    {
                        var pos = 'noun';
                    }
                    else
                    {
                        do
                        {
                        var rand = RandomRange(0, data2.length - 1);
                        }while(blacklist.indexOf(data2[rand].id) < 0)
                        if (data2[rand].hasOwnProperty('partOfSpeech')) {
                            var pos = data2[rand].partOfSpeech;
                        }
                        else {
                            var pos = 'noun';
                        }
                    }
                }
                catch(err)
                {
                    var pos = 'noun';
                }
                console.log("Part of Speech:", pos);
                //grab a rap lyric based on the part of speech and insert the rhyming word
                tweet += getLine(rhyme, pos);
                console.log("Tweet:", tweet);
                //tweet the finished product and log it as well
                T.post('statuses/update', { status: tweet, in_reply_to_status_id: mention.id_str }, function (err, reply) {
                    console.log("error with updating status: " + err);
                });
            });
        }
    });

    console.log('Tweet:', tweet);
}


function handleError(err) {
    console.error('response status:', err.statusCode);
    console.error('data:', err.data);
}


//grabs a number between max and min
function RandomRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

//uses the arrays of part of speech based lyrics from the text files to return a string from the passed in rhyming word and those arrays of strings
function getLine(word, pos) {

    var result = "Oops, we didn't account for something.";
    var rand;
    if (pos == 'verb' || pos == 'verb-transitive') {
        rand = RandomRange(0, (verbTransitives.length - 1));
        result = verbs[rand];
    }
    else if (pos == 'adjective' || pos == 'determiner' || pos == 'pronoun') {
        rand = RandomRange(0, (adjectives.length - 1));
        result = adjectives[rand];
    }
    else if (pos == 'adverb') {
        rand = RandomRange(0, (adverbs.length - 1));
        result = adverbs[rand];
    }
    else if (pos == 'proper-noun') {
        rand = RandomRange(0, (properNouns.length - 1));
        result = properNouns[rand];
    }
    else {
        rand = RandomRange(0, (nouns.length - 1));
        result = nouns[rand];
    }


    //remove the "\n" from the end of the string so it does not add a line break in the middle of the black card
    result = result.substring(0, result.length - 1);
    result += " " + word;

    return result;

}

//check if a word is on the blacklist
function isBlacklisted(data) {
    var result = false;
    for (var i = 0; i < blacklist.length; i++) {
        if (data.indexOf(blacklist[i]) >= 0) {
            result = true;
        }
    }
    return result;
}

//
//  RapBattleBot - Checks its tweet mentions every 10 minutes and if it is tweeted at it uses Wordnik API to find a rhyming word and send 2 bars of a rap battle back
//
var fs = require('fs');
var APIkey = 'YOUR_WORDNIK_API_KEY_HERE';
var Twit = require('twit');
var Wordnik = require('wordnik-bb').init(APIkey);
var restclient = require('restler');
var _ = require('lodash');
//var app = require('express').createServer();

//Fill in your twitter information here
var T = new Twit({
    consumer_key: '***'
  , consumer_secret: '***'
  , access_token: '***'
  , access_token_secret: '***'
})

// I deployed to Nodejitsu, which requires an application to respond to HTTP requests
// If you're running locally you don't need this, or express at all.
/*
app.get('/', function (req, res) {
    res.send('Hello world.');
});
app.listen(3000);
*/

//fill the blacklist with words that aren't allowed
var blacklist = [];
try {
    var data = fs.readFileSync('Text/badwords.txt', 'ascii');
    data.split('\n').forEach(function (line) {
        if (line.length > 0) {
            blacklist.push(line);
        }
    });
}
catch (err) {
    console.error("There was an error opening the file:");
    console.log(err);
}

var nouns = fs.readFileSync('Text/noun.txt').toString().split("\n");
var adjectives = fs.readFileSync('Text/adjective.txt').toString().split("\n");
var adverbs = fs.readFileSync('Text/adverb.txt').toString().split("\n");
var verbTransitives = fs.readFileSync('Text/verb-transitive.txt').toString().split("\n");
var properNouns = fs.readFileSync('Text/proper-noun.txt').toString().split("\n");

//Log that the program is running
console.log('RapBattleBot: Running.');


//
//  attempt at using the bot on the twitter stream
//
var stream = T.stream('statuses/filter', { track: ['@RapBattleBot'] } );
console.log('Stream Open');

stream.on('tweet', function (tweet) {
    if (tweet.user.screen_name != 'RapBattleBot') {
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

function rap(mention) {
    //var last = last word of tweet @ me
    //var tweet = @whatever
    var tweet = "";
    tweet += ".@" + mention.user.screen_name + " ";
    var text = mention.text;
    var words = text.split(" ");
    var position = (words.length - 1);
    var last = words[position];
    while((last.indexOf('#') != -1 || last.indexOf('@') != -1 ) && position > 0) {
        position -= 1;
        last = words[position];
    }
    if (/^[a-zA-Z0-9- ]*$/.test(last) == false) {
        last = last.substring(0, last.length - 1);
    }
    console.log("Last word of tweet:", last);
    var word = new Wordnik.Word(
    {
        word: last,
        params:
        {
            relationshipTypes: 'rhyme',
            limitPerRelationshipType: 100,
            hasDictionaryDef: true,
            useCanonical: true
        }
    });

    console.log("Word matched by wordnik:", word.id);

    //uses restclient to grab a set of rhyming words
    var rhymeURL = 'http://api.wordnik.com:80/v4/word.json/' + word.id + '/relatedWords?useCanonical=false&relationshipTypes=rhyme&limitPerRelationshipType=30&api_key=' + APIkey;
    var rhyme;
    restclient.json(rhymeURL).on('complete', function (data) {
        //console.log('RETRIEVED FROM WORDNIK:', data);
        if (data == 'undefined' || data.length < 1) {
            tweet += word.id;
            tweet += "? I thought you wanted to rhyme.\nComeback with something better or quit wasting my time.";
            console.log("Tweet:", tweet);
            //tweet the finished product and log it as well
            T.post('statuses/update', { status: tweet, in_reply_to_status_id: mention.id_str }, function (err, reply) {
                console.log("error with updating status: " + err);
            });
        }
        else {
            rhyme = data[0].words[RandomRange(0, data[0].words.length - 1)];
            console.log("Rhyming word:", rhyme);
            var posURL = 'http://api.wordnik.com:80/v4/word.json/' + word.id + '/definitions?limit=200&includeRelated=true&sourceDictionaries=all&useCanonical=false&includeTags=false&api_key=' + APIkey;
            restclient.json(posURL).on('complete', function (data2) {
                if (data2 == 'undefined' || data2.length < 2) {
                    var pos = 'noun';
                }
                else {
                    var rand = RandomRange(0, data2.length - 1);
                    if (data2[rand].hasOwnProperty('partOfSpeech')) {
                        var pos = data2[rand].partOfSpeech;
                    }
                    else {
                        var pos = 'noun';
                    }
                }
                console.log("Part of Speech:", pos);
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

function getLine(word, pos) {

    var result = "Oops, we didn't account for something.";
    var rand;
    if (pos == 'verb' || pos == 'verb-transitive') {
        rand = RandomRange(0, (verbsTransitives.length - 1));
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

function isBlacklisted(data) {
    var result = false;
    for (var i = 0; i < blacklist.length; i++) {
        if (data.indexOf(blacklist[i]) >= 0) {
            result = true;
        }
    }
    return result;
}
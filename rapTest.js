var text = '@RapBattleBot can you handle ?? #winnign';
var words = text.split(" ");
//grab the last word
var position = (words.length - 1);
var last = words[position];
last.trim();
var invalid = true;
while (invalid && position > 0){
  console.log('current iteration:',last);
  invalid = false;
  //ignore the last word and go one previous if the last word is a mention or hastag as people often throw these in after their actual lyric
  while (last.indexOf('#') != -1 || last.indexOf('@') != -1 ) {
      console.log('failed hastag',last);
      position -= 1;
      last = words[position];
      last.trim();
      invalid = true;
      //if there are any special characters try stripping them from back to front and move back a word if they are all that's left

  }
  while(/^[a-zA-Z0-9- ]*$/.test(last) == false){
    console.log('failed characters:', last);
      console.log('substringing:',last);
      last = last.substring(0, last.length - 1);
      invalid = true;
  }
  if(last.length == 0 || last == ' '){
    console.log('empty word now');
    position -= 1;
    last = words[position];
    last.trim();
    invalid = true;
  }
}
console.log('final answer:', last);

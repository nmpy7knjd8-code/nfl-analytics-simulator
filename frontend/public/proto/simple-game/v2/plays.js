// Real plays: frontend/lib/dailyPack.json, dailySet("2026-10-27") (day #299).
// Timeouts match PR #120 quizPack.json situation.posteam_timeouts/defteam_timeouts (and nflverse *_timeouts_remaining). Null hides the dots.
// Play result and final score from nflverse play_by_play desc/fixed_drive_result, rewritten in plain words.
window.DAY=299;
window.COLORS={NYG:"#0B2265",PHI:"#004C54",NE:"#002244",BAL:"#241773",DET:"#0076B6",KC:"#E31837",CAR:"#0085CA",NO:"#D3BC8D",HOU:"#03202F",TB:"#A71930"};
// v: pack reveal.values (used only to grade; never shown). end: yardline_100 where the ball ended (nflverse), -7 = through the uprights.
window.PLAYS=[
{v:{go:.0279705,punt:.0166536},end:49,nick:"EAGLES",hp:"#004C54",hs2:"#A5ACAF",endTxt:"Converted · PHI 49",away:"NYG",home:"PHI",pos:"NYG",as:3,hs:19,q:4,clock:"13:37",yl100:50,dist:1,ato:2,hto:3,team:"Giants",
 coach:"go",what:"Went for it. A 1-yard catch got the first down, and the drive ended in a touchdown.",final:"The Eagles won 22–16.",best:"go",close:null,
 sent:"The Giants trail the Eagles 19–3 with 13:37 left. It's 4th and 1 at midfield."},
{v:{go:.406666,punt:.346591,fg:.406086},end:-7,nick:"PATRIOTS",hp:"#002244",hs2:"#C60C30",endTxt:"35-yd FG · good",away:"BAL",home:"NE",pos:"NE",as:7,hs:0,q:2,clock:"15:00",yl100:16,dist:6,ato:3,hto:3,team:"Patriots",
 coach:"fg",what:"Kicked a 35-yard field goal. It was good.",final:"The Ravens won 37–26.",best:"go",close:"fg",
 sent:"The Patriots trail the Ravens 7–0 at the start of the 2nd quarter. It's 4th and 6 at the Baltimore 16."},
{v:{go:.179335,punt:.150314},end:58,nick:"CHIEFS",hp:"#E31837",hs2:"#FFB612",endTxt:"Incomplete",away:"DET",home:"KC",pos:"DET",as:7,hs:14,q:2,clock:"0:03",yl100:58,dist:10,ato:0,hto:0,team:"Lions",
 coach:"go",what:"Went for it. The deep pass fell incomplete, and the half ended.",final:"The Lions won 21–20.",best:"go",close:null,
 sent:"The Lions trail the Chiefs 14–7 with 3 seconds left in the half. It's 4th and 10 at their own 42."},
{v:{go:.918667,punt:.907607,fg:.919462},end:38,nick:"PANTHERS",hp:"#0085CA",hs2:"#000000",endTxt:"Incomplete",away:"NO",home:"CAR",pos:"CAR",as:0,hs:13,q:3,clock:"5:11",yl100:38,dist:4,ato:3,hto:2,team:"Panthers",
 coach:"go",what:"Went for it. The pass fell incomplete, and New Orleans took over.",final:"The Panthers won 22–14.",best:"fg",close:"go",
 sent:"The Panthers lead the Saints 13–0 with 5:11 left in the 3rd. It's 4th and 4 at the New Orleans 38."},
{v:{go:.537563,punt:.448106,fg:.618018},end:-7,nick:"TEXANS",hp:"#03202F",hs2:"#A71930",endTxt:"29-yd FG · good",away:"TB",home:"HOU",pos:"HOU",as:30,hs:30,q:4,clock:"8:48",yl100:11,dist:11,ato:3,hto:3,team:"Texans",
 coach:"fg",what:"Kicked a 29-yard field goal. It was good.",final:"The Texans won 39–37.",best:"fg",close:null,
 sent:"The Texans and Buccaneers are tied 30–30 with 8:48 left. It's 4th and goal at the Tampa Bay 11."}];
// sample player run used for the mockup end screen (not real users)
window.PICKS=["go","fg","punt","go","fg"];

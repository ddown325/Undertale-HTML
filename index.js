const CHANGE_ASPECT_RATIO = true;
var bodyElement = document.getElementsByTagName("body")[0];
var statusElement = document.getElementById("status");
var progressElement = document.getElementById("progress");
var spinnerElement = document.getElementById("spinner");
var canvasElement = document.getElementById("canvas");
var outputElement = document.getElementById("output");
var outputContainerElement = document.getElementById("output-container");
var qrElement = document.getElementById("QRCode");
var qr2Element = document.getElementById("QR2Code");
var qrButton = document.getElementById("QRButton");
var qr2Button = document.getElementById("QR2Button");
var pauseMenu = document.getElementById("pauseMenuContainer"); /* legacy (hidden) */
var resumeButton = document.getElementById("resumeButton");
var quitButton = document.getElementById("quitButton");
canvasElement.addEventListener("click", function() { canvasElement.focus(); });

const messageContainerElement = document.getElementById("message-container");
const messagesElement = document.getElementById("messages");
let rollbackMessages = [];

let clearRollbackMessagesTimeoutId = -1;
const showRollbackMessage = function (message) {
  let messages = "";
  rollbackMessages.push(message);
  rollbackMessages.forEach(m => messages += "<p>" + m + "</p>");

  messagesElement.innerHTML = messages;
  messageContainerElement.style.display = 'block';

  if (clearRollbackMessagesTimeoutId === -1) {
    clearTimeout(clearRollbackMessagesTimeoutId);
  }
  clearRollbackMessagesTimeoutId = setTimeout(clearRollbackMessages, 5000);
};

const clearRollbackMessages = function () {
  clearRollbackMessagesTimeoutId = -1;
  rollbackMessages = [];
  messageContainerElement.style.display = 'none';
};

var startingHeight, startingWidth;
var startingAspect;
var Module = {
  preRun: [],
  postRun: [],
  print: (function () {
    var element = document.getElementById("output");
    if (element) element.value = ""; // clear browser cache
    return function (text) {
      if (arguments.length > 1)
        text = Array.prototype.slice.call(arguments).join(" ");
      // These replacements are necessary if you render to raw HTML
      //text = text.replace(/&/g, "&amp;");
      //text = text.replace(/</g, "&lt;");
      //text = text.replace(/>/g, "&gt;");
      //text = text.replace('\n', '<br>', 'g');
      console.log(text);
      if (text === "Entering main loop.") {
        // It seems that this text ensures game is loaded.
        ensureAspectRatio();
      }
      if (element) {
        element.value += text + "\n";
        element.scrollTop = element.scrollHeight; // focus on bottom
      }
    };
  })(),
  printErr: function (text) {
    if (arguments.length > 1)
      text = Array.prototype.slice.call(arguments).join(" ");
    console.error(text);
  },
  canvas: (function () {
    var canvas = document.getElementById("canvas");

    return canvas;
  })(),
  setStatus: function (text) {
    if (!Module.setStatus.last)
      Module.setStatus.last = { time: Date.now(), text: "" };
    if (text === Module.setStatus.last.text) return;
    var m = text.match(/([^(]+)\((\d+(\.\d+)?)\/(\d+)\)/);
    var now = Date.now();
    if (m && now - Module.setStatus.last.time < 30) return; // if this is a progress update, skip it if too soon
    Module.setStatus.last.time = now;
    Module.setStatus.last.text = text;
    if (m) {
      text = m[1];
      progressElement.value = parseInt(m[2]) * 100;
      progressElement.max = parseInt(m[4]) * 100;
      progressElement.hidden = false;
      spinnerElement.hidden = false;
    } else {
      progressElement.value = null;
      progressElement.max = null;
      progressElement.hidden = true;

      // If there are no status text, we are finished and can display
      // the canvas and hide the spinner
      if (!text) {
        spinnerElement.style.display = "none";
        canvasElement.style.display = "block";
      }
    }
    statusElement.innerHTML = text;
  },
  totalDependencies: 0,
  monitorRunDependencies: function (left) {
    this.totalDependencies = Math.max(this.totalDependencies, left);
    Module.setStatus(
      left
        ? "Preparing... (" +
            (this.totalDependencies - left) +
            "/" +
            this.totalDependencies +
            ")"
        : "All downloads complete."
    );
  },
};
Module.setStatus("Downloading...");
window.onerror = function (event) {
  // TODO: do not warn on ok events like simulating an infinite loop or exitStatus
  Module.setStatus("Exception thrown, see JavaScript console");
  spinnerElement.style.display = "none";
  Module.setStatus = function (text) {
    if (text) Module.printErr("[post-exception status] " + text);
  };
};

// Route URL GET parameters to argc+argv
if (typeof window === "object") {
  Module['arguments'] = window.location.search.substr(1).trim().split('&');
  // If no args were passed arguments = [''], in which case kill the single empty string.
  if (!Module['arguments'][0]) {
    Module['arguments'] = [];
  }
}

function toggleConsole() {
  var isShown = outputElement.style.display === "flex";
  if (isShown) {
    outputElement.style.display = "none";
    outputElement.scrollIntoView(false);
  } else {
    outputElement.style.display = "flex";
    outputElement.scrollIntoView(true);
  }
}

function toggleQRCode() {
  var isShown = !qrElement.hidden;
  if (isShown) {
    qrElement.hidden = true;
    qrButton.innerHTML = "Show QRCode";
  } else {
    qrElement.hidden = false;
    qrButton.innerHTML = "Hide QRCode";
  }
}

function toggleQRCode2() {
  var isShown = !qr2Element.hidden;
  if (isShown) {
    qr2Element.hidden = true;
    qr2Button.innerHTML = "Show Opera GX QRCode";
  } else {
    qr2Element.hidden = false;
    qr2Button.innerHTML = "Hide Opera GX QRCode";
  }
}

/*
var g_extLostContext = null;

function toggleWebGLContext() {
  if (g_extLostContext == null) {
    var canvas = document.getElementById('canvas');
    var gl = canvas.getContext('webgl2');
    g_extLostContext = gl.getExtension('WEBGL_lose_context');
  } // end if
  var button = document.getElementById("webglbutton");
  var text = button.textContent || button.innerText;
  if (text.trim() == "Lose WebGL Context") {
    g_extLostContext.loseContext();
    button.textContent = "Restore WebGL Context";
  } // end if
  else {
    g_extLostContext.restoreContext();
    button.textContent = "Lose WebGL Context";
    g_extLostContext = null;
  } // end else
}
*/
function toggleElement(id) {
  var elem = document.getElementById(id);
  if (elem) {
    elem.style.display = elem.style.display == 'block' ? 'none' : 'block';
  }
}

var g_pWadLoadCallback = undefined;
function setWadLoadCallback( _wadLoadCallback ) 
{
  g_pWadLoadCallback = _wadLoadCallback;
}

var g_pAddAsyncMethod = -1;

function setAddAsyncMethod( asyncMethod )
{
  g_pAddAsyncMethod = asyncMethod;
}

var g_pJSExceptionHandler = undefined;

function setJSExceptionHandler( exceptionHandler )
{
  if (typeof exceptionHandler == "function") {
      g_pJSExceptionHandler = exceptionHandler;
  } // end if
} // end setJSExceptionHandler

function hasJSExceptionHandler()
{
  return (g_pJSExceptionHandler != undefined) && (typeof g_pJSExceptionHandler == "function");
} // end hasJSExceptionHandler

function doJSExceptionHandler( exceptionJSON )
{
  if (typeof g_pJSExceptionHandler == "function") {
    var exception = JSON.parse( exceptionJSON );
    g_pJSExceptionHandler( exception );
  } // end if
} // end doJSExceptionHandler

function manifestFiles()
{
  return [ "runner.data",
"runner.js",
"runner.wasm",
"audio-worklet.js",
"game.unx",
"mus_alphysfix.ogg",
"mus_amalgam.ogg",
"mus_ambientwater.ogg",
"mus_anothermedium.ogg",
"mus_bad.ogg",
"mus_barrier.ogg",
"mus_battle1.ogg",
"mus_battle2.ogg",
"mus_bergentruckung.ogg",
"mus_bgflamea.ogg",
"mus_birdnoise.ogg",
"mus_birdsong.ogg",
"mus_boss1.ogg",
"mus_cast_1.ogg",
"mus_cast_2.ogg",
"mus_cast_3.ogg",
"mus_cast_4.ogg",
"mus_cast_5.ogg",
"mus_cast_6.ogg",
"mus_cast_7.ogg",
"mus_chokedup.ogg",
"mus_churchbell.ogg",
"mus_computer.ogg",
"mus_confession.ogg",
"mus_coolbeat.ogg",
"mus_core.ogg",
"mus_coretransition.ogg",
"mus_core_ambience.ogg",
"mus_creepy_ambience.ogg",
"mus_crickets.ogg",
"mus_cymbal.ogg",
"mus_dance_of_dog.ogg",
"mus_date.ogg",
"mus_date_fight.ogg",
"mus_date_tense.ogg",
"mus_deeploop2.ogg",
"mus_disturbing.ogg",
"mus_dogappear.ogg",
"mus_dogmeander.ogg",
"mus_dogroom.ogg",
"mus_dogshrine_1.ogg",
"mus_dogshrine_2.ogg",
"mus_dogshrine_xbox.ogg",
"mus_dogsong.ogg",
"mus_dontgiveup.ogg",
"mus_doorclose.ogg",
"mus_dooropen.ogg",
"mus_drone.ogg",
"mus_dummybattle.ogg",
"mus_dununnn.ogg",
"mus_elevator.ogg",
"mus_elevator_last.ogg",
"mus_endarea_parta.ogg",
"mus_endarea_partb.ogg",
"mus_endingexcerpt1.ogg",
"mus_endingexcerpt2.ogg",
"mus_express_myself.ogg",
"mus_fallendown2.ogg",
"mus_fearsting.ogg",
"mus_flowey.ogg",
"mus_f_6s_1.ogg",
"mus_f_6s_2.ogg",
"mus_f_6s_3.ogg",
"mus_f_6s_4.ogg",
"mus_f_6s_5.ogg",
"mus_f_6s_6.ogg",
"mus_f_alarm.ogg",
"mus_f_destroyed.ogg",
"mus_f_destroyed2.ogg",
"mus_f_destroyed3.ogg",
"mus_f_finale_1.ogg",
"mus_f_finale_1_l.ogg",
"mus_f_finale_2.ogg",
"mus_f_finale_3.ogg",
"mus_f_intro.ogg",
"mus_f_newlaugh.ogg",
"mus_f_newlaugh_low.ogg",
"mus_f_part1.ogg",
"mus_f_part2.ogg",
"mus_f_part3.ogg",
"mus_f_saved.ogg",
"mus_f_wind1.ogg",
"mus_f_wind2.ogg",
"mus_gameover.ogg",
"mus_ghostbattle.ogg",
"mus_harpnoise.ogg",
"mus_hereweare.ogg",
"mus_hotel.ogg",
"mus_hotel_battle.ogg",
"mus_house1.ogg",
"mus_house2.ogg",
"mus_intronoise.ogg",
"mus_kingdescription.ogg",
"mus_lab.ogg",
"mus_leave.ogg",
"mus_menu0.ogg",
"mus_menu1.ogg",
"mus_menu2.ogg",
"mus_menu3.ogg",
"mus_menu4.ogg",
"mus_menu5.ogg",
"mus_menu6.ogg",
"mus_mettafly.ogg",
"mus_mettatonbattle.ogg",
"mus_mettaton_ex.ogg",
"mus_mettaton_neo.ogg",
"mus_mettaton_pretransform.ogg",
"mus_mettmusical1.ogg",
"mus_mettmusical2.ogg",
"mus_mettmusical3.ogg",
"mus_mettmusical4.ogg",
"mus_mettsad.ogg",
"mus_mett_applause.ogg",
"mus_mett_cheer.ogg",
"mus_mode.ogg",
"mus_mtgameshow.ogg",
"mus_muscle.ogg",
"mus_musicbox.ogg",
"mus_myemeow.ogg",
"mus_mysteriousroom2.ogg",
"mus_mystery.ogg",
"mus_napstachords.ogg",
"mus_napstahouse.ogg",
"mus_news.ogg",
"mus_news_battle.ogg",
"mus_ohyes.ogg",
"mus_oogloop.ogg",
"mus_operatile.ogg",
"mus_options_fall.ogg",
"mus_options_summer.ogg",
"mus_options_winter.ogg",
"mus_papyrus.ogg",
"mus_papyrusboss.ogg",
"mus_piano.ogg",
"mus_prebattle1.ogg",
"mus_predummy.ogg",
"mus_race.ogg",
"mus_rain.ogg",
"mus_rain_deep.ogg",
"mus_repeat_1.ogg",
"mus_repeat_2.ogg",
"mus_reunited.ogg",
"mus_rimshot.ogg",
"mus_ruins.ogg",
"mus_ruinspiano.ogg",
"mus_sansdate.ogg",
"mus_sfx_a_grab.ogg",
"mus_sfx_chainsaw.ogg",
"mus_sfx_hypergoner_charge.ogg",
"mus_sfx_hypergoner_laugh.ogg",
"mus_sfx_rainbowbeam_hold.ogg",
"mus_shop.ogg",
"mus_sigh_of_dog.ogg",
"mus_silence.ogg",
"mus_smallshock.ogg",
"mus_smile.ogg",
"mus_snoresymphony.ogg",
"mus_snowwalk.ogg",
"mus_snowy.ogg",
"mus_spider.ogg",
"mus_spoopy.ogg",
"mus_spoopy_holiday.ogg",
"mus_spoopy_wave.ogg",
"mus_star.ogg",
"mus_sticksnap.ogg",
"mus_story.ogg",
"mus_story_stuck.ogg",
"mus_st_happytown.ogg",
"mus_st_him.ogg",
"mus_st_meatfactory.ogg",
"mus_st_troubledingle.ogg",
"mus_temshop.ogg",
"mus_temvillage.ogg",
"mus_tension.ogg",
"mus_tone2.ogg",
"mus_tone3.ogg",
"mus_toomuch.ogg",
"mus_toriel.ogg",
"mus_town.ogg",
"mus_tv.ogg",
"mus_undyneboss.ogg",
"mus_undynefast.ogg",
"mus_undynepiano.ogg",
"mus_undynescary.ogg",
"mus_undynetheme.ogg",
"mus_undynetruetheme.ogg",
"mus_vsasgore.ogg",
"mus_waterfall.ogg",
"mus_waterquiet.ogg",
"mus_wawa.ogg",
"mus_whoopee.ogg",
"mus_wind.ogg",
"mus_woofenstein.ogg",
"mus_woofenstein_loop.ogg",
"mus_wrongnumbersong.ogg",
"mus_wrongworld.ogg",
"mus_xpart.ogg",
"mus_xpart_2.ogg",
"mus_xpart_a.ogg",
"mus_xpart_b.ogg",
"mus_xpart_back.ogg",
"mus_x_undyne.ogg",
"mus_x_undyne_pre.ogg",
"mus_yourbestfriend_3.ogg",
"mus_zzz_c.ogg",
"mus_zzz_c2.ogg",
"mus_zz_megalovania.ogg",
"mus_z_ending.ogg",
"snd_ballchime.ogg",
"snd_curtgunshot.ogg",
"snd_mushroomdance.ogg",
"lang/lang_en.json",
"lang/lang_ja.json" ].join( ";");
}

function manifestFilesMD5()
{
  return [ "df5bfcc85c4776fadfb79ce2dc9fae76",
"e326eaa5b8c4615cc473610459395225",
"f71a3a6a351db50641cec0b037fb7aa3",
"e8f1e8db8cf996f8715a6f2164c2e44e",
"be1043d478b3cae351f71616d26ac116",
"da78df4767592b0759de45f1a97f7c05",
"bc7c594cda5c6c1b0276fb86a11e175b",
"41833545251f09c1bec5c6dc9075c2d9",
"02e5c1016fbfdb38208f53ffbba7cc91",
"c822cce868d5d5da649042e0e0ebda87",
"69d74a2206407e2142852d93dd487c00",
"c874fac8074463f6553f31f187739d49",
"b21501e5480c84104fcd8c5bef3f794a",
"810736e47c62c892b35cd1351bb73253",
"ec530b41e8d5379630ce7d393e04010d",
"4c747a34751c7c4f929d0b327a16fd66",
"96f66dfb043bacc084456e0ce3a94ce1",
"fef4f2a0e5785983b50d59f1fa115301",
"2341ca2c35f2a794cef1a6a8b87297ea",
"f8930580c5cf369ee44e788d857bc812",
"cece597f19f2f58765583a4a0985bbbf",
"0133c414f18de420888ef91fa11e68d6",
"48354f04ed5cccdcd433e1338432b9e7",
"61ea58834a750cf19dce318bf14f872b",
"1a17b5d86a38824386f32dd5931fb9f5",
"993ab092a91281cef837031c27762eca",
"3bf0a505d6bed97ee719635cedb77ed0",
"8e697d78742f7ced3074d5b3de527bd2",
"c954bae75aecb0c5e0e61a623daa5058",
"0545056f0d3739fec900262d9cf3f71c",
"ee97d108bb6f00a9d5453ad92ba90ed4",
"c09d8614fc9e82c0ef9e8c3595eff48d",
"5a93189e2d83a227951409b2558dc20a",
"8da7797a0afc096c8ea80f7563a1a9e8",
"0a8d0a1a3a0f29edd196aaa9b25b965d",
"616bde2717ce1e3cfef6ecdc5d1e9cff",
"e6bbaf13bee8cf54abef390db8dc8043",
"7e9e17c8113258eb6841a0c19db50235",
"3cfb5982892bd0401ae51d487754469b",
"82376be6c01247648d2871d1e65670fe",
"6b5e3ddeaae0e7b266ad1dbe36f6c659",
"c2ef07fe8cf1065d7dc0ce7623afb461",
"34aac764846818ddfcd9fe51b1735840",
"bd620494ebf0d4c3f0e1420eb9ec29db",
"4174e48143428589c635ebd80be26ba4",
"d840f04fe2d489a493fb08b98fcd13f4",
"51297cd125bdf73dd20355076faf0686",
"2fa24b0cb78ee593cc46b6674adadbe6",
"0d7c7d90bf9bf7caffc9293baa6943ff",
"e71d40c71c88aefbfed05f4586f0b748",
"6bd25337cfc4b1953f6b5e89de525f60",
"f74d974714b5e30f7a6bddbb80a936c2",
"500e949e5553cffd7e74fcf53f7a8212",
"ec7a6f6a8ba9b9627818b22a4c4e60e5",
"f690c4f3644ed786ecfb2b9709f83a30",
"6cff8d3ca085b705737dce6821bee9d4",
"c18765d66495b4cedca021cab1892779",
"c548d533b1752d920c67a71e55d7c037",
"cd7e248be7d7e44ba4ab1cde58a2a698",
"ccb8c76d1fabe6a00900c260c8f60377",
"bdd050061a4f3acb331b24f2176a4372",
"477b5f728903d887f2fd7c324952619f",
"dc34c1a634d79e0e82f3d1c36b93139e",
"20c598f24e90dac10608ecd7cb0b1a88",
"69abab52827a32dbea1890dfcc47edd3",
"26753c34dab307bf604ac688309087d2",
"9ecacfbcc3d89804ad75557ca193286c",
"6101716cdcc8e729da8eda6a87ef9f14",
"62552e07865610b0cba57c9869de2401",
"8a4b010335b7beaddc8ac5c16ea7ed34",
"8578870bce59800cd8a928fa5fd4ad1b",
"4d31e6ac5eb05a80f32e3c601ddf8fec",
"19d021d650bf039d7bf85bde98120c56",
"0ce9d9e85f679905a1c18ca1baa0782b",
"4b1640dcf812a913d4dce69f1fe367ad",
"cfd7bfdd69ac76de8ae332c2f98bc948",
"4c0f1bfa9c6d60bd5ac7db8dca4f1c05",
"585d78ef45e579c5995cc2e8f5166c02",
"9cf26736eb1538df96ef22ddeae6cf1e",
"146db7658e6f5c595704313493da7071",
"2f9fef7ffb0cd349143dcf4b6d176658",
"36ed5ea40e8ae8e9514f0600bd2121e0",
"66a2b95cdf0f455aa466bc53cb7168a8",
"6710c4289b039b34bd30ac5fdb1750db",
"a1cfa99d1b1bbfb19a41e6dc1c516ad5",
"2efee86ec99598f51c243cb0b17dc15f",
"34f0a8d1d3c09d5d3ff820fcf609195c",
"5fe7944621b07bcc7cb8bc0c19742d79",
"9ff9e1a55aa5773201ee05fff26769cc",
"7a87bd383da4341f37f6812b17c71608",
"63f06968c583b4fa361d2872bdefde65",
"d926918de9a83dc7fc2e1229d8da974e",
"b1cc6eca637b37bef061e045fb0709fb",
"f0f6bb21d3e1d9d89af7d0613fe57b30",
"67a0d016462fc3579e4f6cb10d55c292",
"9e5182b87d248aafd6e2a11e03451e88",
"b36824389ff9122d7b21d383f76ebc9a",
"0351a00eec6902cbb945b82e8157aad8",
"60e7fbf5bba17bc754c5ed73c4cf2cc4",
"215e814833b0b295d9dc77f73424a927",
"22119044bd7163a6ef287c7ff8f44d93",
"682cfd2d63190792e90a446700006049",
"54c19b6cbd1e4843a25bfdcdd1c7e8c5",
"3218ef384b1cbe2fc25e5f0a4384ad3f",
"e4932be38e462f150790b5e3b9c4b8f9",
"7dc4b8849c4d59c07fb459056520fe02",
"8abff4631c86e01743bd797784d72444",
"6d5552fe33e1ba63593caa8cbea27154",
"d134f352d10695d1df309e66fe9af25b",
"318325bd0c1e0e30fe6ee6bc03b839de",
"dfd18d36b2fe83a6df0622562772ca67",
"f22b0910b3dcd87fefad32739911f254",
"318f7647b8633fcc78ccf3ecd1e00472",
"11214178c08bc4ff6c1e4153ad2fdb57",
"241eb6aac846b04de0ef88842d38d04b",
"2e05e6b6632a631ca584331d0883f879",
"591dbe91a6bb7a02a7997012eac176b7",
"3a1a149228180dc817c24abb052d0df0",
"0aa7d8ec42691b0917cc35ac731e7197",
"376b45ea459448c59176495b944a3c47",
"17f7bb881c3a2e010d0499257f97c3fb",
"39e201f39c9dacf6a61b3e82b5f23fbd",
"b16c38f631e93f7aa20c13df738da3f8",
"9f3154e798c6c0f224363c621c4a6c37",
"d616a3125a586a195629edd453610f1a",
"58afe5128c6debe061e8db4dd0a85a74",
"209f4dc46f070bcddb21d81a21e0c6e1",
"dd4c71773de6d1bc8b9cbdd19615c387",
"635f2a7d4fd56a1263b15e3a2b8023ab",
"54a537839b67aa3f714441163aefd7e8",
"4d5381f57585771d802ae50630807115",
"c14a14d94aa4ff21b0e41df35c23b456",
"be2e2f60dfc171596533200e5b48f937",
"1f732768f7048d0f731a5ff8d000ac2f",
"1cdc26560e7a51286ae5f6ada0d016e4",
"db41b8c83d1047089b7d6ecc4abab8e1",
"2fe041901d6b8ca2dd4cf95ff68a40ab",
"8d2ccf942cf631af6d2ebdeb1b059045",
"42c6da1ebeced3827ae1caacba31e75b",
"c2317932cce3bbb09607d4e5d63be3c1",
"568a7644a0365710f472d62f4bfb8418",
"fa311544cd39cfc95702ea51e40f00fc",
"0402adfe9c04d68f7abc361d54c357e2",
"1325bcfcbad515b7da08e499482e2516",
"f85c483a8b31c1fad2e0baadfa0857b4",
"53e4880b949686d31a09b24663209028",
"bdd03c6ef4f0addbc8fa2c5e2687dc53",
"716b582edd790f86bbb793bc7b78fedb",
"a328ccd3cd36e017f439f2af4311115b",
"f141e866d006c221609e94449450a76d",
"888b2a1adbdf1204a1aae3360d922f39",
"0b8697a09b0a61591e6a37760983ede7",
"5309cdf3e09e2e09cbcffd80dcf0a017",
"ed3b7afaa80d6f8c38bdd6a8299390d0",
"38b9b24895d830763ff507fc0b0afa32",
"40720c196ecd9958340529972480ba2f",
"6b2bf3b700cabbb7b508ffce3346828b",
"16db2039b368906470f55503da8d5169",
"01220afeec811fc56808faa077167d6f",
"5d3235b81d8500b31e6ceb2f87671569",
"4023b92ab4be3fb7d886daa1b122e3a6",
"948438ddd06e90813726c7f6c6e54bf8",
"ed9a555b41815270a181b257edb2b14a",
"efdb3eb023170311464126f66590ae28",
"edb5522c83c78e5e368fd3973abbc39e",
"dc682c776842e809cfee6e18aa820008",
"fbc9b8447bbaddc7e48fea0319ce40d3",
"afbffcc24ffab775f7d1fb0d28ec81a8",
"3a6905a36ff74139caeb3544b2e30e8f",
"1257acf00e253d95e8d6a5507a649d46",
"35a460242766b2df2bb4d7313f322dfb",
"75f1b4e92de4cf856dfebecef0e34158",
"05bedcc9f8a4f070972fcf9382d47c3c",
"d513016fc481d731cd38a6bae2aac3e1",
"1344e0cf66ce8366c4b152aed9da88ee",
"3eccb33888d5a963391b553b2393d1fe",
"30666f5f569bcc6c0d27b0ca52c45c39",
"34561ffe2507c9442be463ab25be9fc9",
"be36835ffe6ac8a0edbbcf35f0b8e0d8",
"63eca387303d5681440b4cfaac84b196",
"9ef01b4210a78e7b94c73c9d491f4859",
"74e2d70237d7b5ebcd508bd3f9c760a5",
"79e088ea1a4d4ea54bc39467174ab0c3",
"357c9755776d61ab22050ecb1be8f254",
"b324dad3e4cf89cdb45a94bcc5e3a3fe",
"f7aec17e2b187d496cf4b5465fba1a85",
"c633704bfd49470b4a0db47af2a87b9e",
"1a675a4b86626d986097b0f773277f0a",
"a2565e53ba3fda1ecd9d5f8052f851e6",
"1b2f4a710dcc7bf5883ca2dffd7e5a40",
"fe9ca2b9996bc9a7b385fa4b45199843",
"fc2af4edd8f1f399e49ea01c5988a44f",
"9ea4950364a7f592c89bcccf0eaeb322",
"b16aa92baca71fb77d0a744ac888b6e4",
"2b8198c8997e1a5414010334a1da81e5",
"639a5f915607bbae068e6a19cc3706a9",
"93e476326fc956008f705f22cdb7f9e4",
"7ace18338075b2914e78fc264a2eb934",
"fccd21261648b1cdbba0204d651746d5",
"df15bd9e1625d3cdaec94e86135fb8aa",
"121268d407994d04ae61d015eba20d5e",
"bc98c009f3f0bd0169e11ce663f8c298",
"adfefe6d1d9e80a90ed86233431928a0",
"b5afd6a71d09d9e97fb29cddbf2e3fe1",
"ff2d1e092e21f6c0aa77c1ddec8af823",
"886a07101fc0f98ccc90b63cc11ae3e9",
"6b33078dca0c53cf50b6b1c4f18d0c19",
"2bf06048e322754dc1cc4c98d5ee1c50",
"87395579cdf3fad32dbf1fcfbc8bcb10",
"1341aa450a89f60a8f8b5fa50f1fbb4d",
"dfe0ee8620f7f5b132b8890cfbd68fa4",
"f54e68ee70488442f4406e055bd3de64",
"29fd7ef535d0a61a8f1a8fc684f41246",
"3ea95393e37003490ed3707d3e9276f7",
"fc49ca134bbec186ac6b849740d208a8",
"68d404e8253721ac67ee2d530f837d91",
"d51094cea295befbdc753f8ade15141c",
"73d7332839c2582238a48f3b437e7c16" ];
}

function onFirstFrameRendered()
{
    //console.log("First frame rendered!");
}

function onGameSetWindowSize(width,height)
{
    console.log("Window size set to width: " + width + ", height: " + height);

    startingHeight = height;
    startingWidth = width;
    startingAspect = startingWidth / startingHeight;
}

function ensureAspectRatio() {
  if (canvasElement === undefined) {
    return;
  }

  if (!CHANGE_ASPECT_RATIO) {
    return;
  }
  
  if (startingHeight === undefined && startingWidth === undefined) {
    return;
  }

  canvasElement.classList.add("active");

  const maxWidth = window.innerWidth;
  const maxHeight = window.innerHeight;
  var newHeight, newWidth;

  // Find the limiting dimension.
  var heightQuotient = startingHeight / maxHeight;
  var widthQuotient = startingWidth / maxWidth;

  if (heightQuotient > widthQuotient) {
    // Max out on height.
    newHeight = maxHeight;
    newWidth = newHeight * startingAspect;
  } else {
    // Max out on width.
    newWidth = maxWidth;
    newHeight = newWidth / startingAspect;
  }

  canvasElement.style.height = newHeight + "px";
  canvasElement.style.width = newWidth + "px";
}

function pause() { // Don't change the name - GX Mobile calls it when the app becomes inactive.
  if (!canvasElement.classList.contains("active")) { // Wait for the canvas to load.
    return
  }

  GM_pause();
  canvasElement.classList.add("paused");
  if (window.UTPauseMenu) { window.UTPauseMenu.open(); } /* the real in-game menu */
}

function resume() {
  GM_unpause();
  if (window.UTPauseMenu) { window.UTPauseMenu.close(); }
  canvasElement.classList.remove("paused");
  canvasElement.classList.add("unpaused");
  enterFullscreenIfSupported();
  lockOrientationIfSupported();
}

function quitIfSupported() {
  // Back to the loading screen (the browser build has no parent app to return to).
  window.location.reload();
}

function enterFullscreenIfSupported() {
  if (!window.oprt || !window.oprt.enterFullscreen) { /* GX Mobile API */
    return;
  }

  window.oprt.enterFullscreen();
  let viewStatus = GM_get_view_status();
  viewStatus.fullscreen = true;
  GM_set_view_status(viewStatus);
}

function lockOrientationIfSupported() {
  if (!window.oprt || !window.oprt.lockPortraitOrientation || !window.oprt.lockLandscapeOrientation) { /* GX Mobile API */
    return;
  }

  let viewStatus = GM_get_view_status();
  if (viewStatus.landscape === true && viewStatus.portrait === false) {
    window.oprt.lockPortraitOrientation();
  } else if (viewStatus.landscape === false && viewStatus.portrait === true) {
    window.oprt.lockPortraitOrientation();
  }
}

/* Observe the dimensions of body and ensureAspectRatio of the canvas (whilst taking up maximum space)
 *
 * NOTE(robertz):
 *  We also need to request an Animation Frame to do this, if we do not, resizeObserver might throw error
 *  "ResizeObserver loop limit exceeded", which means that
 *  "[...] ResizeObserver was not able to deliver all observations within a single animation frame"
 *  https://stackoverflow.com/a/50387233 (source).
 *
 *  There are different ways to solve the issue, since the error is benign (meaning it wont crash anything)
 *  we could choose to ignore it via changing the window.onerror method, i.e
 *  ```
 *  window.onerror((event)=> {
 *    if(event==="ResizeObserver loop limit exceeded") {
 *       return
 *    }
 *     ///...rest
 *  }
 *  ```
 *  But for now we request an animationFrame which seems to be the recommended way to go about it.
 *
 * NOTE(ddrechny):
 *  window.innerWidth/Height value updates are sometimes delayed in WebKit on iOS after an orientation
 *  change. Hence we're calling ensureAspectRatio one more time after a delay to minimize the risk of
 *  sizing the canvas with outdated values.
 */
const resizeObserver = new ResizeObserver(() => {
  window.requestAnimationFrame(ensureAspectRatio);
  setTimeout(() => window.requestAnimationFrame(ensureAspectRatio), 100);
});
resizeObserver.observe(document.body);

/* NOTE(ddrechny):
 *  Body needs to be scrollable on desktop browsers for debug buttons to be accessible.
 *  On mobile browsers scrolling can be activated accidentally and debug buttons aren't useful,
 *  so it's better to disable it.
 */
if (/Android|iPhone|iPod/i.test(navigator.userAgent)) {
  bodyElement.className = "scrollingDisabled";
  canvasElement.classList.add("animatedSizeTransitions");
  outputContainerElement.hidden = true;
}

/* QUIT is always available in the browser build - it reloads to the loading screen. */

setWadLoadCallback(() => {
  enterFullscreenIfSupported();
  lockOrientationIfSupported();
});

var read_ptr = 0;
read_int = () => {
  var heap_slice = Module["HEAPU8"].subarray(read_ptr, read_ptr + 4);
  var buffer = new ArrayBuffer(4);
  var barray = new Uint8Array(buffer);
  for (var i = 0; i < 4; i++) barray[i] = heap_slice[i];
  var int_array = new Int32Array(buffer);
  var int = int_array[0];
  read_ptr += 4;
  return int;
};

read_pointer = () => {
  var ptr = Module.getValue(read_ptr, "*");
  read_ptr += 8;
  return ptr;
};

readPeer = () => {
  var peer = {
    peer: read_int(),
    local_frames_ahead: read_int(),
    rtt: read_int(),
    remote_frame_rate: read_int(),
    remote_frame_delay: read_int(),
  }

  return peer;
}

readStats = (s) => {
  read_ptr = s;

  var stats = {
    kbps_sent: read_int(),
    kbps_received: read_int(),
    pps_sent: read_int(),
    pps_received: read_int(),
    frame_rate: read_int(),
    rollbacks: read_int(),
    frame_delay: read_int(),
    skipped_frames: read_int(),
    rejected_inputs: read_int(),
    relay_rtt: read_int(),
    peer: read_int(),
    num_peers: read_int(),

    serialization_stats: {
      state_size: read_int(),
      managed_instances_num: read_int()
    },
    peers: []
  }

  read_ptr = read_pointer();
  for (var j = 0; j < stats.num_peers; ++j) {
    stats.peers.push(readPeer());
  }

  return stats;

}

var acceptable_rollback_frames = 0;
var set_acceptable_rollback = (frames) => {
  acceptable_rollback_frames = frames;
}

drawLocal = (peers_elem, frame_delay_elem, relay_rtt_elem, peer_name, relay_rtt, frame_delay) => {
    drawPeer(peers_elem, frame_delay_elem, peer_name, 0, frame_delay, 0);

    const per_pixel = 100/16;
    const frames_rtt = relay_rtt/16; // To ceil, or not to ceil - that's the question.

    const y = 100 - frames_rtt * per_pixel;

    const relay_rtt_marker = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    relay_rtt_marker.setAttribute('x1', -2);
    relay_rtt_marker.setAttribute('y1', y);
    relay_rtt_marker.setAttribute('x2', 2);
    relay_rtt_marker.setAttribute('y2', y);

    relay_rtt_marker.setAttribute('data-relay-rtt', relay_rtt);

    relay_rtt_marker.classList.add(peer_name);
    relay_rtt_marker.classList.add('relay-rtt');

    relay_rtt_elem.appendChild(relay_rtt_marker);
}

drawPeer = (peers_elem, frame_delay_elem, peer_name, rtt, frame_delay, frames_ahead) => {
  const per_pixel = 100/16;
  const frames_rtt = rtt/16; // To ceil, or not to ceil - that's the question.
  const x = 50 + frames_ahead * per_pixel;
  const y = 100 - frames_rtt * per_pixel;

  const peer = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  peer.setAttribute('cx', x);
  peer.setAttribute('cy', y);
  peer.setAttribute('r', 1);

  peer.setAttribute('data-rtt', rtt);
  peer.setAttribute('data-frame-delay', frame_delay);
  peer.setAttribute('data-frames-ahead', frames_ahead);

  peer.classList.add(peer_name);
  peer.classList.add('peer');

  peers_elem.appendChild(peer);

  const peer_frame_delay = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  peer_frame_delay.setAttribute('cx', x);
  peer_frame_delay.setAttribute('cy', y);
  peer_frame_delay.setAttribute('r', frame_delay * per_pixel);

  peer_frame_delay.classList.add(peer_name);
  peer_frame_delay.classList.add('peer-frame-delay');

  frame_delay_elem.appendChild(peer_frame_delay);

  if (acceptable_rollback_frames > 0) {
    const peer_acceptable_rollback = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    peer_acceptable_rollback.setAttribute('cx', x);
    peer_acceptable_rollback.setAttribute('cy', y);
    peer_acceptable_rollback.setAttribute('r', (frame_delay + acceptable_rollback_frames) * per_pixel);

    peer_acceptable_rollback.classList.add(peer_name);
    peer_acceptable_rollback.classList.add('peer-acceptable-rollback');
    frame_delay_elem.appendChild(peer_acceptable_rollback);
  }
}

report_stats = (stats_data) => {

  var stats = readStats(stats_data);

  var peers_elem = document.getElementById("stats-network-peers");
  var frame_delay_elem = document.getElementById("stats-network-peer-frame-delays");
  var relay_rtt_elem = document.getElementById("stats-network-relay-rtt");

  peers_elem.innerHTML = '';
  frame_delay_elem.innerHTML = '';
  relay_rtt_elem.innerHTML = '';

  stats.peers.forEach(p => {
    drawPeer(peers_elem, frame_delay_elem, 'peer' + p.peer, p.rtt, p.remote_frame_delay, p.local_frames_ahead);
  });

  drawLocal(peers_elem, frame_delay_elem, relay_rtt_elem, 'peer' + stats.peer, stats.relay_rtt, stats.frame_delay);
}

let wallpaperConfig = {};
const wallpaperConfigKey = 'wallpaper-config';

function wallpaper_init_config_controls(definitions) {
  const wallpaperContainer = document.getElementById("wallpaper-container");
  wallpaperContainer.style.display = "block";

  let configStyle = '<style type="text/css">' +
    'body { color: white; font-family: Averta, -apple-system, "Segoe UI", system-ui, sans-serif; font-style: normal; font-size: 10px; }' +
    '.config-row { display: flex; justify-content: flex-start; align-items: center; padding: .5em; }' +
    '.config-row > label { flex: 1 }' +
    '.config-row > input { flex: initial; }' +
    '.config-row > textarea { flex: 1; }' +
    '.config-row-label { font-size: 12px; font-weight: 600; }' +
    'button { padding: 8px 16px; border-radius: 4px; background-color: unset; border-color: rgb(199, 159, 234); color: rgb(199, 159, 234); }' +
    '</style>';
  let configHTML = '<html><head><title></title>' + configStyle + '</head><body>' +
    '<div class="wallpaper-header"><h1>Live Wallpaper Configurator</h1><button id="wallpaper-reset-parameters">Reset parameters</button></div>' +
    '<div class="wallpaper-config" id="wallpaper-config"></div>' +
    '</body></html>'

  const wallpaperConfigDocument = document.getElementById("wallpaper-config-iframe").contentDocument;
  wallpaperConfigDocument.open();
  wallpaperConfigDocument.write(configHTML);
  wallpaperConfigDocument.close();

  const storedConfig = JSON.parse(localStorage.getItem(wallpaperConfigKey));
  if (storedConfig) {
    wallpaperConfig = storedConfig;
  }

  const configElement = wallpaperConfigDocument.getElementById("wallpaper-config");
  const resetButton = wallpaperConfigDocument.getElementById("wallpaper-reset-parameters");
  resetButton.addEventListener("click", (e) => {
    wallpaper_reset_config();
    wallpaperConfig = {};
    add_config_elems(configElement, definitions);
    notify_config_change();
  }, false);

  add_config_elems(configElement, definitions);
  notify_config_change();
}

function add_config_elems(configElement, definitions) {
  while (configElement.hasChildNodes()) {
    configElement.removeChild(configElement.lastChild);
  }

  definitions.value
    .map(d => create_elems(d, wallpaperConfig, ""))
    .filter(e => e !== null && e !== undefined)
    .map(e => configElement.appendChild(e));
}

function create_elems(definition, config, prefixId) {
    if (definition.type === undefined || definition.name === undefined) {
      console.log("missing definition name or type for: ", definition);
      return null;
    }

    if  (definition.type === "section") {
      return create_section_elem(definition, config, prefixId);
    }


    if (definition.value === undefined ) {
      console.log("missing definition value for: ", definition);
      return null;
    }

    if (definition.type === "range") {
      return create_range_elem(definition, config, prefixId);
    }

    if (definition.type === "boolean") {
      return create_checkbox_elem(definition, config, prefixId);
    }

    if (definition.type === "color" || definition.type === "colour") {
      return create_color_elem(definition, config, prefixId);
    }

    if (definition.type === "string") {
      return create_text_elem(definition, config, prefixId);
    }

    if (definition.type === "string_multiline") {
      return create_multiline_text_elem(definition, config, prefixId);
    }

    if (definition.type === "select") {
      return create_select_elem(definition, config, prefixId);
    }

    if (definition.type === "file" || definition.type === "folder") {
      return create_not_supported_elem(definition, config);
    }
    
    console.log("missing config value for: ", definition);
    return null;
}

function create_section_elem(definition, config, prefixId) {
  const divElem = document.createElement("div");

  const headerElem = document.createElement("h2");
  headerElem.innerHTML = definition.label;

  divElem.appendChild(headerElem);

  const sectionId = prefixId + definition.name + "-"
  if (!config[definition.name]) {
    config[definition.name] = {};
  }

  definition.children
    .map(c => create_elems(c, config[definition.name], sectionId))
    .filter(e => e !== null && e !== undefined)
    .map(e => divElem.appendChild(e));

  return divElem;
}

function get_initial_value(definition, config) {
  let value =  definition.value;
  const configValue = config[definition.name];
  if (configValue && (typeof(configValue) === typeof(value))) {
    value = configValue;
  }

  return value;
}

function wrap_with_label(inputElem, definition, prefixId) {
  const controlElem = document.createElement("div");
  controlElem.classList.add(definition.name + "-control");
  controlElem.classList.add("config-row");

  const labelElem = document.createElement("label");
  labelElem.htmlFor = prefixId + definition.name;
  labelElem.innerHTML = "<span class='config-row-label'>" + (definition.label || definition.name) + "</span>";
  if (definition.description) {
    labelElem.innerHTML += "<p>" + definition.description + "</p>";
  }
  controlElem.appendChild(labelElem);

  inputElem.id = prefixId + definition.name;
  controlElem.appendChild(inputElem);

  return controlElem;
}

function create_range_elem(definition, config, prefixId) {
  const value = get_initial_value(definition, config);

  const valueElem = document.createElement("span");
  valueElem.style = "margin: 0.5em";
  valueElem.innerHTML = "(" + value + ")";

  const stepElem = document.createElement("input");
  stepElem.id = prefixId + definition.name;
  stepElem.type = "range";
  stepElem.min = definition.min || 0;
  stepElem.max = definition.max || 100;
  stepElem.step = definition.step || 1;
  stepElem.value = value;

  config[definition.name] = value;
  function range_value_updated(e) {
    const valueUpdate = Number(e.target.value);
    config[definition.name] = valueUpdate;
    valueElem.innerHTML = "(" + valueUpdate + ")";

    notify_config_change();
  }

  stepElem.addEventListener("change", range_value_updated, false);
  stepElem.addEventListener("input", range_value_updated, false);

  const valueWrapper = document.createElement("span");
  valueWrapper.appendChild(valueElem);
  valueWrapper.appendChild(stepElem);

  return wrap_with_label(valueWrapper, definition, prefixId);
}

function create_checkbox_elem(definition, config, prefixId) {
  const value = get_initial_value(definition, config);

  const checkboxElem = document.createElement("input");
  checkboxElem.type = "checkbox";
  checkboxElem.checked = value;
  
  config[definition.name] = value;
  checkboxElem.addEventListener("change", (e) => {
    const valueUpdate = Boolean(e.target.checked);
    config[definition.name] = valueUpdate;
    notify_config_change();
  });

  return wrap_with_label(checkboxElem, definition, prefixId);
}

function create_color_elem(definition, config, prefixId) {
  const value = get_initial_value(definition, config);

  const bgrColor = value;
  const r = (bgrColor & 0x0000ff);
  const g = (bgrColor & 0x00ff00) >> 8;
  const b = (bgrColor & 0xff0000) >> 16;
  const rgbColor = (r << 16) + (g << 8) + b;
  const color = "#" + rgbColor.toString(16).padStart(6, '0');

  const colorElem = document.createElement("input");
  colorElem.type = "color";
  colorElem.value = color;

  config[definition.name] = value;
  function color_value_updated(e) {
    const color = e.target.value;
    const rgbColor = parseInt(color.slice(1), 16);
    const r = (rgbColor & 0xff0000) >> 16;
    const g = (rgbColor & 0x00ff00) >> 8;
    const b = (rgbColor & 0x0000ff);
    const bgrColor = (b << 16) + (g << 8) + r;

    config[definition.name] = bgrColor;
    notify_config_change();
  }

  colorElem.addEventListener("change", color_value_updated, false);
  colorElem.addEventListener("input", color_value_updated, false);
  
  return wrap_with_label(colorElem, definition, prefixId);
}

function create_text_elem(definition, config, prefixId) {
  const value = get_initial_value(definition, config);

  const textElem = document.createElement("input");
  textElem.type = "text";
  textElem.value = value;
  console.log("text", value)
  if (definition.max_length && definition.max_length > 0) {
    textElem.maxLength = definition.max_length;
  }

  config[definition.name] = value;
  textElem.addEventListener("input", (e) => {
    config[definition.name] = e.target.value;
    notify_config_change();
  });
  
  return wrap_with_label(textElem, definition, prefixId);
}

function create_multiline_text_elem(definition, config, prefixId) {
  const value = get_initial_value(definition, config);

  const textareaElem = document.createElement("textarea");
  textareaElem.rows = 5;
  textareaElem.cols = 50;
  textareaElem.value = value;
  if (definition.max_length && definition.max_length > 0) {
    textareaElem.maxLength = definition.max_length;
  }

  config[definition.name] = value;
  textareaElem.addEventListener("input", (e) => {
    config[definition.name] = e.target.value;
    notify_config_change();
  });
  
  return wrap_with_label(textareaElem, definition, prefixId);
}

function create_select_elem(definition, config, prefixId) {
  const value = get_initial_value(definition, config);

  const selectElem = document.createElement("select");
  selectElem.value = value;
  
  const options = definition.options || [];
  options.forEach(o => {
    const option = document.createElement("option");
    option.value = o;
    option.text = o;
    option.selected = o == value ? "selected" : "";
    selectElem.appendChild(option);
  })

  config[definition.name] = value;
  selectElem.addEventListener("change", (e) => {
    e.selected = "selected";
    config[definition.name] = e.target.value;
    notify_config_change();
  });
  
  return wrap_with_label(selectElem, definition, prefixId);
}

function create_not_supported_elem(definition, config, prefixId) {
  const labelElem = document.createElement("label");
  labelElem.innerHTML = "Not supported in browser";

  config[definition.name] = definition.value;
  return wrap_with_label(labelElem, definition, prefixId);
}

function notify_config_change() {
  console.log(wallpaperConfig)
  localStorage.setItem(wallpaperConfigKey, JSON.stringify(wallpaperConfig));

  wallpaper_update_config(JSON.stringify(wallpaperConfig));
}

/* [ut-backup:start] ==========================================================

   DETERMINATION BACKUP  --  Shift+Ctrl+E  (and the pause menu's SAVE STATES)
   ---------------------------------------------------------
   One keystroke (or menu action) snapshots the save mirror (every "ut*" key
   the save-sync maintains) into a tagged backup slot:

     route state  PACIFIST / NEUTRAL / GENOCIDE (via the game's own murderlv)
     boss tag     SANS, UNDYNE THE UNDYING, ASGORE, ... checkpoint context
     stats        name / LV / location, plus the timestamp + size

   Up to 24 slots are kept (auto-backups pruned first). AUTO-BACKUP (on by
   default, toggle in SAVE STATES) snapshots your save whenever it changes -
   no menu needed - at most once every 5 minutes.

   Restore copies a slot back over BOTH the localStorage mirror and the
   GameMaker file system (IndexedDB /_savedata), then prompts a reload.
   Delete is available from the menu. Backups live under "ut::backup::*"
   and are never included in later snapshots.

   Console helpers (window.UndertaleBackups): .make() .list() .restore(id)
   .del(id) .auto(on/off) .toggleFullscreen()

   ========================================================== [ut-backup:end] */
(function () {
  "use strict";
  if (window.__utBackupInit) return;
  window.__utBackupInit = true;

  var MIRROR_PREFIX = "ut";
  /* NOTE: the prefix deliberately does NOT start with "ut" - the save-sync
     imports every "ut*" localStorage key into the GameMaker file system
     (IndexedDB /_savedata), and a backup record there is not a valid file
     node, which crashes the runner's IDBFS mount at boot (flaky "EXCEPTION
     THROWN"). The old "ut::backup::*" records are migrated away at load. */
  var BACKUP_PREFIX = "soulstate::";
  var AUTO_KEY = "soulstate::auto";
  var AUTO_EVERY_MS = 5 * 60 * 1000;
  var MAX_BACKUPS = 24;
  var MAX_AUTO_KEPT = 12;

  /* ---------- flavor text ---------- */
  var FLAVOR_SAVED = [
    "(Knowing your progress is safe fills you with determination.)",
    "(A safe copy of your file exists now. It fills you with determination.)",
    "(Somewhere, a little star is keeping watch over your data.)",
    "(You feel your save data being cradled gently. You are filled with determination.)",
    "(You are filled with determination.)"
  ];
  var FLAVOR_EMPTY = [
    "(Nothing has been saved yet. But you are still filled with determination.)",
    "(You feel like this journey has only just begun.)"
  ];
  var FLAVOR_FAIL = ["(The backup box is full. Your determination persists anyway.)"];

  function pick(l) { return l[Math.floor(Math.random() * l.length)]; }

  /* ---------- one-time migration / cleanup ----------
     v1.2-era backups lived under "ut::backup::*" and the save-sync imported
     them into the game's file system, where they can crash the IDBFS mount.
     Move the records to the new prefix and delete the imported copies. */
  (function migrate() {
    var OLD = "ut::backup::", moved = 0;
    try {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(OLD) === 0) keys.push(k);
      }
      for (var j = 0; j < keys.length; j++) {
        var kk = keys[j];
        if (kk === OLD + "auto") {
          if (localStorage.getItem(AUTO_KEY) === null) {
            localStorage.setItem(AUTO_KEY, localStorage.getItem(kk));
          }
        } else {
          var nk = BACKUP_PREFIX + kk.slice(OLD.length);
          if (localStorage.getItem(nk) === null) localStorage.setItem(nk, localStorage.getItem(kk));
          moved++;
        }
        localStorage.removeItem(kk);
      }
    } catch (e) {}
    /* the IndexedDB junk purge is NOT done here: opening /_savedata at page
       load races the runner's own IDBFS mount (cached boots run at ~2 s) and
       can abort it -> "EXCEPTION THROWN". It runs lazily post-boot instead. */
    if (moved) console.log("[UndertaleBackups] migrated " + moved + " old backup records to " + BACKUP_PREFIX);
  })();

  /* ---------- snapshot / restore ---------- */
  function collectMirror() {
    var out = {}, files = 0, chars = 0;
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (!k || k.indexOf(MIRROR_PREFIX) !== 0) continue;
      if (k.indexOf("ut::") === 0) continue;
      var v = localStorage.getItem(k);
      out[k] = v;
      files++;
      chars += k.length + (v ? v.length : 0);
    }
    return { data: out, files: files, bytes: chars * 2 };
  }

  function metaOfNow() {
    if (!window.UTSaveInfo) return null;
    var info = window.UTSaveInfo.parse();
    if (!info) return null;
    return {
      name: info.name, lv: info.lv, kills: info.kills, xp: info.xp,
      room: info.room, roomName: info.roomName, area: info.area,
      route: info.route, boss: info.boss, murderlv: info.murderlv,
      playTime: info.time
    };
  }

  function backupIds() {
    var ids = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf(BACKUP_PREFIX) === 0) {
        var id = Number(k.substring(BACKUP_PREFIX.length));
        if (!isNaN(id) && id > 0) ids.push(id);
      }
    }
    ids.sort(function (a, b) { return b - a; });
    return ids;
  }

  function readRecord(id) {
    try { return JSON.parse(localStorage.getItem(BACKUP_PREFIX + id)); }
    catch (e) { return null; }
  }

  function prune() {
    var ids = backupIds();
    if (ids.length <= MAX_BACKUPS) return;
    var recs = [];
    for (var i = 0; i < ids.length; i++) {
      var r = readRecord(ids[i]);
      recs.push({ id: ids[i], t: r ? r.t : ids[i], auto: r ? !!r.auto : false });
    }
    /* deletion order: the oldest AUTO states first, then the oldest states */
    recs.sort(function (a, b) {
      if (a.auto !== b.auto) return a.auto ? -1 : 1;   /* autos deleted first */
      return a.t - b.t;                                 /* oldest first       */
    });
    var excess = ids.length - MAX_BACKUPS;
    for (var d = 0; d < excess && d < recs.length; d++) {
      localStorage.removeItem(BACKUP_PREFIX + recs[d].id);
    }
  }

  function makeBackup(opts) {
    opts = opts || {};
    purgeIdbJunk();
    var snap = collectMirror();
    if (snap.files === 0) {
      return { ok: true, empty: true, files: 0, bytes: 0, slot: backupIds().length };
    }
    var id = Date.now();
    var record = {
      t: id, files: snap.files, bytes: snap.bytes,
      data: snap.data, meta: metaOfNow(), auto: !!opts.auto
    };
    try {
      localStorage.setItem(BACKUP_PREFIX + id, JSON.stringify(record));
    } catch (e) {
      return { ok: false, files: snap.files, bytes: snap.bytes, slot: backupIds().length };
    }
    prune();
    return {
      ok: true, empty: false, files: snap.files, bytes: snap.bytes,
      slot: backupIds().length, meta: record.meta, id: id
    };
  }

  /* ---------- IndexedDB (GameMaker file system) writes ---------- */
  function idbPutNode(key, text) {
    return new Promise(function (resolve) {
      var bytes;
      try { bytes = new TextEncoder().encode(text); }
      catch (e) {
        var s = unescape(encodeURIComponent(text));
        var arr = new Uint8Array(s.length);
        for (var i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i);
        bytes = arr;
      }
      var node = { timestamp: new Date(), mode: 33206, contents: bytes.buffer };
      var req;
      try { req = indexedDB.open("/_savedata"); }
      catch (e) { resolve(false); return; }
      req.onsuccess = function (e) {
        try {
          var db = e.target.result;
          var tx = db.transaction(["FILE_DATA"], "readwrite");
          tx.objectStore("FILE_DATA").put(node, key);
          tx.oncomplete = function () { resolve(true); db.close(); };
          tx.onerror = function () { resolve(false); db.close(); };
        } catch (er) { resolve(false); }
      };
      req.onerror = function () { resolve(false); };
    });
  }

  function mirrorToIdbKey(k) {
    if (k.indexOf("ut/_savedata/") === 0) return k.slice(2);          /* /_savedata/x   */
    if (k.length > 2 && k.indexOf("ut") === 0 && k.indexOf("/") > 2) return null; /* not a flat game file */
    var name = k.slice(2);
    return /^[\w.\-]+$/.test(name) ? "/_savedata/" + name : null;
  }

  function restoreBackup(id) {
    var raw = readRecord(id);
    if (!raw || !raw.data) return { ok: false, n: 0 };
    var n = 0, idbJobs = [];
    for (var k in raw.data) {
      if (!Object.prototype.hasOwnProperty.call(raw.data, k)) continue;
      localStorage.setItem(k, raw.data[k]);
      n++;
      var idbKey = mirrorToIdbKey(k);
      if (idbKey && window.UTSaveInfo) {
        var txt = window.UTSaveInfo.decodeMirror(raw.data[k]);
        if (typeof txt === "string") idbJobs.push(idbPutNode(idbKey, txt));
      }
    }
    return { ok: true, n: n, idb: idbJobs.length ? Promise.all(idbJobs) : Promise.resolve([]) };
  }

  function deleteBackup(id) {
    localStorage.removeItem(BACKUP_PREFIX + id);
    return true;
  }

  /* ---------- auto-backup ---------- */
  function autoEnabled() {
    var v = localStorage.getItem(AUTO_KEY);
    return v === null ? true : v === "1";
  }
  function setAuto(on) { localStorage.setItem(AUTO_KEY, on ? "1" : "0"); }

  var lastAutoAt = 0, lastSig = null;
  function mirrorSignature() {
    var h = 0, s = "";
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (!k || k.indexOf("ut/_savedata/") !== 0) continue;
      if (k.indexOf("::") >= 0) continue;
      s += k + "\u0001" + (localStorage.getItem(k) || "") + "\u0002";
    }
    for (var j = 0; j < s.length; j++) {
      h = (h * 31 + s.charCodeAt(j)) | 0;
    }
    return h;
  }

  setInterval(function () {
    if (!autoEnabled()) return;
    var sig = mirrorSignature();
    if (sig !== lastSig) {
      if (lastSig !== null && Date.now() - lastAutoAt >= AUTO_EVERY_MS && sig !== 0) {
        lastAutoAt = Date.now();
        makeBackup({ auto: true });
      }
      lastSig = sig;
    }
  }, 15000);
  lastSig = mirrorSignature();
  window.addEventListener("beforeunload", function () {
    /* a save that changed in the final seconds still gets caught */
    if (!autoEnabled()) return;
    var sig = mirrorSignature();
    if (sig !== lastSig && Date.now() - lastAutoAt >= AUTO_EVERY_MS && sig !== 0) {
      makeBackup({ auto: true });
    }
  });

  /* ---------- lazy IndexedDB junk purge (post-boot only) ----------
     removes any non-file-node junk the save-sync may have imported in older
     builds; guarded so it runs at most once per storage generation. */
  var idbPurgeDone = false;
  function purgeIdbJunk() {
    if (idbPurgeDone) return;
    idbPurgeDone = true;
    try {
      var req = indexedDB.open("/_savedata");
      req.onsuccess = function (e) {
        var db = e.target.result;
        try {
          var tx = db.transaction(["FILE_DATA"], "readwrite");
          var st = tx.objectStore("FILE_DATA");
          var cur = st.openCursor(), junk = [];
          cur.onsuccess = function (ev) {
            var c = ev.target.result;
            if (!c) { for (var d = 0; d < junk.length; d++) st.delete(junk[d]); db.close(); return; }
            if (typeof c.value !== "object" || c.value === null || !c.value.timestamp) {
              if (String(c.key).indexOf(":") >= 0 || String(c.key).indexOf("backup") >= 0) junk.push(c.key);
            }
            c.continue();
          };
        } catch (er) { try { db.close(); } catch (e2) {} }
      };
    } catch (e2) {}
  }

  /* ---------- overlay ---------- */
  var overlay = null, flavorEl = null, metaEl = null, titleEl = null, hideTimer = -1;

  function buildOverlay() {
    if (overlay) return;
    var box = document.createElement("div");
    box.id = "utBackupOverlay";
    var star = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    star.setAttribute("viewBox", "0 0 24 24");
    star.setAttribute("width", "26");
    star.setAttribute("height", "26");
    star.setAttribute("class", "utb-star");
    star.setAttribute("aria-hidden", "true");
    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M12 0 L14.8 9.2 L24 12 L14.8 14.8 L12 24 L9.2 14.8 L0 12 L9.2 9.2 Z");
    path.setAttribute("fill", "#fff200");
    star.appendChild(path);
    titleEl = document.createElement("div");
    titleEl.className = "utb-title";
    flavorEl = document.createElement("div");
    flavorEl.className = "utb-flavor";
    metaEl = document.createElement("div");
    metaEl.className = "utb-meta";
    box.appendChild(star);
    box.appendChild(titleEl);
    box.appendChild(flavorEl);
    box.appendChild(metaEl);
    var style = document.createElement("style");
    style.textContent =
      "#utBackupOverlay{position:fixed;left:50%;bottom:14vh;transform:translate(-50%,0);" +
      "background:#000;border:3px solid #fff;box-shadow:0 0 0 3px #000, inset 0 0 0 1px #000;" +
      "padding:14px 22px 12px;text-align:center;z-index:99999;pointer-events:none;" +
      "font-family:'Courier New','Lucida Console',Monaco,monospace;color:#fff;" +
      "max-width:min(82vw,480px);opacity:0;transition:opacity .18s steps(3,end);}" +
      "#utBackupOverlay.utb-show{opacity:1;}" +
      "#utBackupOverlay .utb-star{animation:utb-spin 2.4s linear infinite;margin:0 auto 6px;}" +
      "#utBackupOverlay .utb-title{font-size:15px;letter-spacing:3px;margin-bottom:8px;}" +
      "#utBackupOverlay .utb-flavor{font-size:13px;line-height:1.55;}" +
      "#utBackupOverlay .utb-meta{font-size:11px;color:#9c9c9c;margin-top:8px;letter-spacing:1px;}" +
      "@keyframes utb-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}" +
      "@media (prefers-reduced-motion:reduce){#utBackupOverlay .utb-star{animation:none;}}";
    document.head.appendChild(style);
    document.body.appendChild(box);
    overlay = box;
  }

  function fmtBytes(n) {
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
    return (n / 1048576).toFixed(1) + " MB";
  }

  function metaLine(m) {
    if (!m) return "";
    var parts = [];
    parts.push(m.route || "?");
    if (m.boss) parts.push(m.boss);
    parts.push("LV " + (m.lv || 1));
    if (m.area) parts.push(m.area);
    return parts.join("  \u00b7  ");
  }

  function showOverlay(result) {
    buildOverlay();
    var line, title, meta;
    if (!result.ok) {
      title = "DETERMINATION";
      line = pick(FLAVOR_FAIL);
      meta = "backup failed";
    } else if (result.empty) {
      title = "DETERMINATION";
      line = pick(FLAVOR_EMPTY);
      meta = "no save data yet";
    } else {
      title = "BACKUP SAVED";
      line = pick(FLAVOR_SAVED);
      meta = metaLine(result.meta) + "  \u00b7  " +
             new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
             "  \u00b7  " + fmtBytes(result.bytes);
    }
    titleEl.textContent = title;
    flavorEl.textContent = "* " + line;
    metaEl.textContent = meta;
    overlay.classList.add("utb-show");
    if (hideTimer !== -1) clearTimeout(hideTimer);
    hideTimer = setTimeout(function () {
      hideTimer = -1;
      overlay.classList.remove("utb-show");
    }, 3200);
  }

  function triggerBackup() {
    var result = makeBackup();
    showOverlay(result);
    return result;
  }

  /* ---------- fullscreen (F4) + keyboard lock ---------- */
  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }
  function lockReservedKeys() {
    try {
      if (navigator.keyboard && navigator.keyboard.lock) {
        var p = navigator.keyboard.lock(["ControlLeft", "ControlRight", "ShiftLeft", "ShiftRight", "KeyE"]);
        if (p && p.catch) p.catch(function () {});
      }
    } catch (e) {}
  }
  function unlockReservedKeys() {
    try { if (navigator.keyboard && navigator.keyboard.unlock) navigator.keyboard.unlock(); }
    catch (e) {}
  }
  function toggleFullscreen() {
    var el = document.documentElement;
    if (fullscreenElement()) {
      if (document.exitFullscreen) {
        var p = document.exitFullscreen();
        if (p && p.catch) p.catch(function () {});
      } else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      return;
    }
    try {
      var r;
      if (el.requestFullscreen) r = el.requestFullscreen();
      else if (el.webkitRequestFullscreen) r = el.webkitRequestFullscreen();
      if (r && r.then) r.then(lockReservedKeys).catch(function () {});
      else lockReservedKeys();
    } catch (e) {}
  }
  document.addEventListener("fullscreenchange", function () { if (!fullscreenElement()) unlockReservedKeys(); });
  document.addEventListener("webkitfullscreenchange", function () { if (!fullscreenElement()) unlockReservedKeys(); });

  /* ---------- keys ---------- */
  window.addEventListener("keydown", function (e) {
    if (e.repeat) return;
    if (e.key === "F4" || e.code === "F4") {
      e.preventDefault();
      toggleFullscreen();
      return;
    }
    var isE = e.code === "KeyE" || (typeof e.key === "string" && e.key.toLowerCase() === "e");
    if (e.ctrlKey && e.shiftKey && isE) {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      triggerBackup();
    }
  }, true);

  /* ---------- console helpers ---------- */
  function listBackups() {
    return backupIds().map(function (id) {
      var r = readRecord(id);
      return {
        id: id,
        when: new Date(id).toLocaleString(),
        files: r ? r.files : "?",
        bytes: r ? r.bytes : "?",
        auto: r ? !!r.auto : false,
        meta: r ? r.meta : null
      };
    });
  }

  function restoreAndReport(id) {
    var res = restoreBackup(id);
    if (res.ok) {
      console.log("[UndertaleBackups] restored " + res.n + " keys from " + new Date(id).toLocaleString() +
                  " - reload the page to pick them up.");
    }
    return res;
  }

  window.UndertaleBackups = {
    make: triggerBackup,
    list: listBackups,
    restore: restoreAndReport,
    del: deleteBackup,
    auto: function (on) { if (arguments.length) setAuto(!!on); return autoEnabled(); },
    toggleFullscreen: toggleFullscreen
  };
})();
/* [ut-saveinfo:start] ==========================================================

   SAVE INFO  --  reads the live save mirror and derives the route state
   ---------------------------------------------------------
   The save-sync mirrors GameMaker's virtual file system (IndexedDB /_savedata)
   into localStorage under "ut/_savedata/<file>". This module parses file0
   (the main save, 553 lines) and derives:

     name / LV / HP / gold / EXP / kills
     murderlv   - exact port of the game's own scr_murderlv (genocide tracker)
     route      - PACIFIST (kills 0) / NEUTRAL / GENOCIDE (murderlv >= 1)
     roomName   - from the embedded 342-room table
     area       - RUINS / SNOWDIN / WATERFALL / HOTLAND / CORE / NEW HOME ...
     boss       - the checkpoint this save sits at: SANS, UNDYNE THE UNDYING,
                  ASGORE, METTATON EX / NEO, FLOWEY, PAPYRUS, TORIEL, ASRIEL

   ========================================================== [ut-saveinfo:end] */
(function () {
  "use strict";
  if (window.UTSaveInfo) return;

  var ROOMS="room_xbox_engagement|room_start|room_introstory|room_introimage|room_intromenu|room_area1|room_area1_2|room_ruins1|room_ruins2|room_ruins3|room_ruins4|room_ruins5|room_ruins6|room_ruins7|room_ruins7A|room_ruins8|room_ruins9|room_ruins10|room_ruins11|room_ruins12A|room_ruins12|room_ruins12B|room_ruins13|room_ruins14|room_ruins15A|room_ruins15B|room_ruins15C|room_ruins15D|room_ruins15E|room_ruins16|room_ruins17|room_ruins18OLD|room_ruins19|room_torhouse1|room_torhouse2|room_torhouse3|room_torielroom|room_asrielroom|room_kitchen|room_basement1|room_basement2|room_basement3|room_basement4|room_basement5|room_ruinsexit|room_tundra1|room_tundra2|room_tundra3|room_tundra3A|room_tundra4|room_tundra5|room_tundra6|room_tundra6A|room_tundra7|room_tundra8|room_tundra8A|room_tundra9|room_tundra_spaghetti|room_tundra_snowpuzz|room_tundra_xoxosmall|room_tundra_xoxopuzz|room_tundra_randoblock|room_tundra_lesserdog|room_tundra_icehole|room_tundra_iceentrance|room_tundra_iceexit_new|room_tundra_iceexit|room_tundra_poffzone|room_tundra_dangerbridge|room_tundra_town|room_tundra_town2|room_tundra_dock|room_tundra_inn|room_tundra_inn_2f|room_tundra_grillby|room_tundra_library|room_tundra_garage|room_tundra_sanshouse|room_tundra_paproom|room_tundra_sansroom_dark|room_tundra_sansroom|room_tundra_sansbasement|room_fogroom|room_water1|room_water2|room_water3|room_water3A|room_water4|room_water_bridgepuzz1|room_water5|room_water5A|room_water6|room_water7|room_water8|room_water9|room_water_savepoint1|room_water11|room_water_nicecream|room_water12|room_water_shoe|room_water_bird|room_water_onionsan|room_water14|room_water_piano|room_water_dogroom|room_water_statue|room_water_prewaterfall|room_water_waterfall|room_water_waterfall2|room_water_waterfall3|room_water_waterfall4|room_water_preundyne|room_water_undynebridge|room_water_undynebridgeend|room_water_trashzone1|room_water_trashsavepoint|room_water_trashzone2|room_water_friendlyhub|room_water_undyneyard|room_water_undynehouse|room_water_blookyard|room_water_blookhouse|room_water_hapstablook|room_water_farm|room_water_prebird|room_water_shop|room_water_dock|room_water15|room_water16|room_water_temvillage|room_water17|room_water18|room_water19|room_water20|room_water21|room_water_undynefinal|room_water_undynefinal2|room_water_undynefinal3|room_fire1|room_fire2|room_fire_prelab|room_fire_dock|room_fire_lab1|room_fire_lab2|room_fire3|room_fire5|room_fire6|room_fire6A|room_fire_lasers1|room_fire7|room_fire8|room_fire_shootguy_2|room_fire9|room_fire_shootguy_1|room_fire_turn|room_fire_cookingshow|room_fire_savepoint1|room_fire_elevator_r1|room_fire_elevator_r2|room_fire_hotdog|room_fire_walkandbranch|room_fire_sorry|room_fire_apron|room_fire10|room_fire_rpuzzle|room_fire_mewmew2|room_fire_boysnightout|room_fire_newsreport|room_fire_coreview2|room_fire_elevator_l2|room_fire_elevator_l3|room_fire_spidershop|room_fire_walkandbranch2|room_fire_conveyorlaser|room_fire_shootguy_3|room_fire_preshootguy4|room_fire_shootguy_4|room_fire_savepoint2|room_fire_spider|room_fire_pacing|room_fire_operatest|room_fire_multitile|room_fire_hotelfront_1|room_fire_hotelfront_2|room_fire_hotellobby|room_fire_restaurant|room_fire_hoteldoors|room_fire_hotelbed|room_fire_elevator_r3|room_fire_precore|room_fire_core1|room_fire_core2|room_fire_core3|room_fire_core4|room_fire_core5|room_fire_core_freebattle|room_fire_core_laserfun|room_fire_core_branch|room_fire_core_bottomleft|room_fire_core_left|room_fire_core_topleft|room_fire_core_top|room_fire_core_topright|room_fire_core_right|room_fire_core_bottomright|room_fire_core_center|room_fire_shootguy_5|room_fire_core_treasureleft|room_fire_core_treasureright|room_fire_core_warrior|room_fire_core_bridge|room_fire_core_premett|room_fire_core_metttest|room_fire_core_final|room_fire_elevator|room_fire_elevator_l1|room_fire_finalelevator|room_castle_elevatorout|room_castle_precastle|room_castle_hook|room_castle_front|room_asghouse1|room_asghouse2|room_asghouse3|room_asgoreroom|room_asrielroom_final|room_kitchen_final|room_basement1_final|room_basement2_final|room_basement3_final|room_basement4_final|room_lastruins_corridor|room_sanscorridor|room_castle_finalshoehorn|room_castle_coffins1|room_castle_coffins2|room_castle_throneroom|room_castle_prebarrier|room_castle_barrier|room_castle_exit|room_undertale_end|room_castle_trueexit|room_outsideworld|room_fire_labelevator|room_truelab_elevatorinside|room_truelab_elevator|room_truelab_hall1|room_truelab_hub|room_truelab_hall2|room_truelab_operatingroom|room_truelab_redlever|room_truelab_prebed|room_truelab_bedroom|room_truelab_mirror|room_truelab_bluelever|room_truelab_hall3|room_truelab_shower|room_truelab_determination|room_truelab_tv|room_truelab_cooler|room_truelab_greenlever|room_truelab_fan|room_truelab_castle_elevator|room_truelab_prepower|room_truelab_power|room_gaster|room_icecave1|room_ice_dog|room2|room_water_fakehallway|room_mysteryman|room_soundtest|TESTROOM|room_water_redacted|room_water13|room_overworld|room_overworld3|bullettest|room_water16A|room_end_castroll|room_end_highway|room_end_beach|room_end_metta|room_end_school|room_end_mtebott|room_creditsdodger|room_end_myroom|room_end_theend|room_spritecheck|room_settings|room_controltest|room_f_start|room_f_intro|room_f_menu|room_f_room|room_floweyx|room_f_phrase|room_fire4|room_fire10_old|room_fire10A_old|room_tundra_placeholder|room_ruins12B_old|room_tundra_rollsnow|room_water7_older|room_meetundyne_old|room_water_mushroom|room_monsteralign_test|room_battle|room_floweybattle|room_fastbattle|room_storybattle|room_gameover|room_shop1|room_shop2|room_shop3|room_shop4|room_shop5|room_riverman_transition|room_papdate|room_adate|room_flowey_endchoice|room_flowey_regret|room_empty|room_emptywhite|room_emptyblack|room_nothingness|room_undertale|room_of_dog|room_quizholder|room_friendtest|room_bringitinguys|room_asrielappears|room_goodbyeasriel|room_asrielmemory|room_asrieltest|room_afinaltest|room_dogshrine|room_dogshrine_ruined|room_dogshrine_mewmew|room_of_bog|room_dogshrine_xbox|room_decomp_settings".split("|");

  /* mirror helpers ------------------------------------------------------- */
  function decodeMirror(raw) {
    if (!raw) return null;
    if (raw.indexOf("JS:") === 0) {
      try { return JSON.parse(raw.slice(3)); } catch (e) { return null; }
    }
    if (raw.indexOf("AB:") === 0) {
      try {
        var b64 = raw.slice(3), bin = atob(b64), s = "";
        for (var i = 0; i < bin.length; i++) s += String.fromCharCode(bin.charCodeAt(i) & 0xff);
        return s;
      } catch (e) { return null; }
    }
    return null;
  }

  function findFile(name) {
    var v = localStorage.getItem("ut/_savedata/" + name);
    if (v !== null) { var d = decodeMirror(v); if (d !== null) return d; }
    v = localStorage.getItem("ut" + name);
    if (v !== null) { var d2 = decodeMirror(v); if (d2 !== null) return d2; }
    return null;
  }

  /* exact port of scr_murderlv ------------------------------------------- */
  function murderlv(f) {
    function g(i) { return (f && f.length > i) ? (+f[i] || 0) : 0; }
    var m = 0;
    if (g(202) === 20) m = 1;
    if (m >= 1 && g(45) >= 4) m = 2;
    if (m >= 2 && g(52) >= 1) m = 3;
    if (m >= 3 && g(53) >= 1) m = 4;
    if (m >= 4 && g(54) >= 1) m = 5;
    if (m >= 5 && g(57) >= 2) m = 6;
    if (m >= 6 && g(203) === 16) m = 7;
    if (m >= 7 && g(67) >= 1) m = 8;
    if (m >= 8 && g(81) >= 1) m = 9;
    if (m >= 9 && g(252) >= 1) m = 10;
    if (m >= 10 && g(204) === 18) m = 11;
    if (m >= 11 && g(251) >= 1 && g(350) >= 1) m = 12;
    if (m >= 12 && g(402) >= 1) m = 13;
    if (m >= 13 && g(397) >= 1) m = 14;
    if (m >= 14 && g(205) === 40) m = 15;
    if (m >= 15 && g(425) >= 1 && g(27) >= 0) m = 16;
    return m;
  }

  function areaOf(rn) {
    if (rn === "room_sanscorridor") return "THE LAST CORRIDOR";
    if (/^room_ruins|^room_f_intro|^room_basement\d*$/.test(rn)) return "RUINS";
    if (/^room_tundra|^room_fogroom/.test(rn)) return "SNOWDIN";
    if (/^room_water/.test(rn)) return "WATERFALL";
    if (/^room_fire_core/.test(rn)) return "CORE";
    if (/^room_fire/.test(rn)) return "HOTLAND";
    if (/^room_castle|^room_lastruins|^room_basement.*_final|^room_asgore|^room_asriel|^room_kitchen|^room_sans/.test(rn)) return "NEW HOME";
    if (/^room_truelab/.test(rn)) return "TRUE LAB";
    if (/^room_end/.test(rn)) return "THE END";
    if (/^room_flowey/.test(rn)) return "???";
    return "THE UNDERGROUND";
  }

  function bossOf(info) {
    var rn = info.roomName, g = info.route === "GENOCIDE";
    if (rn === "room_sanscorridor") return "SANS";
    if (g && (rn === "room_water_trashsavepoint" || rn === "room_water_undynebridge" ||
              rn === "room_water_undynebridgeend" || rn === "room_water_preundyne")) return "UNDYNE THE UNDYING";
    if (/^room_water_undynefinal/.test(rn)) return "UNDYNE";
    if (g && (rn === "room_fire_core_warrior" || rn === "room_fire_core_premett")) return "METTATON NEO";
    if (!g && (rn === "room_fire_core_final" || rn === "room_fire_core_premett")) return "METTATON EX";
    if (rn === "room_asgoreroom" || rn === "room_castle_prebarrier" || rn === "room_castle_barrier") return "ASGORE";
    if (rn === "room_floweyx" || rn === "room_floweybattle") return "FLOWEY";
    if (rn === "room_asrielroom_final") return "ASRIEL";
    if (rn === "room_fogroom") return "PAPYRUS";
    if (/^room_basement[45](_final)?$/.test(rn)) return "TORIEL";
    return null;
  }

  function parse() {
    var txt = findFile("file0");
    if (!txt) return null;
    var L = txt.replace(/\r/g, "").split("\n");
    if (L.length < 553) return null;
    var fl = [];
    for (var i = 32; i < 545; i++) fl.push(+L[i] || 0);
    var info = {
      raw: txt,
      name: (L[0] || "?").slice(0, 12),
      lv: +L[1] || 0,
      maxhp: +L[2] || 0,
      at: +L[4] || 0,
      df: +L[6] || 0,
      xp: +L[9] || 0,
      gold: +L[10] || 0,
      kills: +L[11] || 0,
      weapon: +L[30] || 0,
      armor: +L[31] || 0,
      plot: +L[545] || 0,
      room: +L[551] || 0,
      time: +L[552] || 0,
      flags: fl
    };
    info.murderlv = murderlv(fl);
    info.route = info.kills === 0 ? "PACIFIST" : (info.murderlv >= 1 ? "GENOCIDE" : "NEUTRAL");
    info.roomName = ROOMS[info.room] || ("room " + info.room);
    info.area = areaOf(info.roomName);
    info.boss = bossOf(info);
    info.hp = info.maxhp;
    return info;
  }

  window.UTSaveInfo = {
    parse: parse, murderlv: murderlv, areaOf: areaOf, bossOf: bossOf,
    decodeMirror: decodeMirror, findFile: findFile, ROOMS: ROOMS
  };
})();

/* [ut-pausemenu:start] ==========================================================

   PAUSE MENU  -  built into the game, drawn like the game
   ---------------------------------------------------------
   Esc pauses the engine for real (GM_pause) and renders this menu on a
   640x480 canvas overlay that sits exactly on top of the game canvas - so
   it shares the game's pixel grid and scale. Everything is drawn with an
   embedded 5x7 pixel font, the SOUL is the cursor, selected entries turn
   yellow - the same visual language as the in-game menus.

     RESUME       back to the game
     SAVE STATES  the backup manager: every state is tagged with its route
                  (PACIFIST / NEUTRAL / GENOCIDE) and boss checkpoint
                  (SANS, UNDYNE THE UNDYING, ASGORE, ...). Filter by route,
                  make states, restore, delete, toggle AUTO-BACKUP.
     FULLSCREEN   same as F4
     QUIT         back to the loading screen

   Keyboard: arrows (or WASD) select, Z/ENTER confirm, X/ESC back. Mouse
   works too. While open, game keys are swallowed. GX Mobile's window.pause()
   opens the same menu.

   ========================================================== [ut-pausemenu:end] */
(function () {
  "use strict";
  if (window.__utMenuInit) return;
  window.__utMenuInit = true;

  /* 5x7 pixel font (rows are 5-bit masks, MSB = leftmost pixel) */
  var FONT = {32:[0,0,0,0,0,0,0],33:[28,28,28,28,28,0,28],34:[30,22,22,22,22,22,22],35:[2,0,30,8,30,0,0],36:[12,14,24,14,2,30,12],37:[26,20,28,4,6,15,22],38:[12,14,12,26,22,22,30],39:[28,28,28,28,28,28,28],40:[7,14,28,28,28,14,7],41:[14,7,3,3,3,7,14],42:[12,12,30,30,12,14,22],43:[4,4,4,31,4,4,4],44:[15,15,31,31,28,28,28],45:[31,31,31,31,31,31,31],46:[28,28,28,28,28,28,28],47:[1,2,2,4,4,8,8],48:[14,9,25,29,25,9,14],49:[6,14,6,6,6,6,15],50:[14,9,3,2,4,8,31],51:[14,9,3,6,1,25,14],52:[2,6,10,10,31,2,2],53:[15,8,14,1,1,25,14],54:[15,8,14,25,9,9,14],55:[15,2,2,6,4,4,4],56:[14,9,11,14,25,25,14],57:[14,11,25,9,15,3,14],58:[30,24,0,0,0,24,30],59:[14,0,0,0,14,14,28],60:[3,7,12,24,12,7,3],61:[31,15,0,0,0,15,31],62:[24,14,7,1,7,14,24],63:[14,25,3,6,4,0,4],64:[14,26,30,26,30,16,12],65:[12,12,14,10,30,18,19],66:[30,26,26,30,26,26,30],67:[14,9,24,24,24,9,14],68:[30,27,25,25,25,27,30],69:[31,24,24,31,24,24,31],70:[15,8,8,15,8,8,8],71:[14,9,24,27,25,9,15],72:[25,25,25,31,25,25,25],73:[15,4,4,4,4,4,15],74:[7,3,3,3,3,10,14],75:[26,30,28,28,30,26,27],76:[16,16,16,16,16,16,31],77:[27,27,31,31,21,17,17],78:[25,25,29,29,27,27,27],79:[14,11,25,25,25,11,14],80:[31,25,25,30,24,24,24],81:[14,25,25,25,11,6,3],82:[30,26,26,30,30,26,26],83:[14,25,8,14,1,25,15],84:[30,12,12,12,12,12,12],85:[25,25,25,25,25,9,14],86:[19,18,26,10,14,12,12],87:[19,19,30,30,30,30,26],88:[26,14,12,12,12,10,18],89:[18,10,14,12,12,12,12],90:[30,6,4,12,8,24,30],91:[14,12,12,12,12,12,14],92:[8,8,4,4,2,2,1],93:[31,3,3,3,3,3,31],94:[6,6,14,14,10,11,9],95:[15,15,15,15,15,15,15],96:[14,14,14,6,7,3,3],123:[15,12,12,24,12,12,15],124:[28,28,28,28,28,28,28],125:[12,4,6,2,4,4,12],126:[28,28,12,15,3,3,3]};
  var HEART = [0x18c,0x3de,0x7ff,0x7ff,0x7ff,0x3fe,0x1fc,0xf8,0x70,0x20];   /* 11x10 SOUL, row masks */

  var W = 640, H = 480;
  var canvas = null, ctx = null, raf = -1;

  var S = {
    open: false, mode: "main",       /* main | states | confirm */
    sel: 0, tab: 0, scroll: 0,
    confirm: null,                   /* {kind, id, yes} */
    slots: [], info: null, tick: 0
  };
  var TABS = ["ALL", "PACIFIST", "NEUTRAL", "GENOCIDE"];

  /* ---------- canvas plumbing ---------- */
  function gameCanvas() {
    return document.querySelector("canvas.emscripten") || document.getElementById("canvas");
  }
  function ensureCanvas() {
    if (canvas) return true;
    var gc = gameCanvas();
    if (!gc) return false;
    canvas = document.createElement("canvas");
    canvas.id = "utPauseMenu";
    canvas.width = W;
    canvas.height = H;
    canvas.style.cssText =
      "position:fixed;z-index:99998;image-rendering:pixelated;image-rendering:crisp-edges;" +
      "background:transparent;cursor:default;";
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d");
    if (ctx) ctx.imageSmoothingEnabled = false;
    return true;
  }
  function placeCanvas() {
    if (!canvas) return;
    var gc = gameCanvas();
    var r = gc ? gc.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight };
    canvas.style.left = r.left + "px";
    canvas.style.top = r.top + "px";
    canvas.style.width = r.width + "px";
    canvas.style.height = r.height + "px";
  }
  /* ---------- pixel drawing ---------- */
  function px(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }
  function text(str, x, y, scale, color) {
    str = String(str).toUpperCase();
    ctx.fillStyle = color;
    for (var i = 0; i < str.length; i++) {
      var g = FONT[str.charCodeAt(i)];
      if (!g) g = FONT[63]; /* '?' */
      for (var r = 0; r < 7; r++) {
        var row = g[r];
        if (!row) continue;
        for (var c = 0; c < 5; c++) {
          if (row & (1 << (4 - c))) {
            ctx.fillRect(x + (i * 6 + c) * scale, y + r * scale, scale, scale);
          }
        }
      }
    }
  }
  function textW(str, scale) { return String(str).length * 6 * scale - scale; }
  function heart(x, y, scale, color) {
    ctx.fillStyle = color;
    for (var r = 0; r < HEART.length; r++) {
      var row = HEART[r];
      for (var c = 0; c < 11; c++) {
        if (row & (1 << (10 - c))) ctx.fillRect(x + c * scale, y + r * scale, scale, scale);
      }
    }
  }
  function box(x, y, w, h) {
    px(x, y, w, h, "#fff");            /* white frame      */
    px(x + 5, y + 5, w - 10, h - 10, "#000"); /* black interior */
  }

  var COL = { txt: "#ffffff", sel: "#fff200", hint: "#7f7f7f", red: "#ff0000",
              pac: "#00c0ff", neu: "#ffffff", gen: "#ff4040", auto: "#00ff00" };

  function routeColor(route) {
    return route === "PACIFIST" ? COL.pac : route === "GENOCIDE" ? COL.gen : COL.neu;
  }

  /* ---------- data ---------- */
  function refresh() {
    S.info = window.UTSaveInfo ? window.UTSaveInfo.parse() : null;
    var all = window.UndertaleBackups ? window.UndertaleBackups.list() : [];
    var f = TABS[S.tab];
    S.slots = f === "ALL" ? all : all.filter(function (s) { return s.meta && s.meta.route === f; });
    if (S.sel > Math.max(0, S.slots.length)) S.sel = Math.max(0, S.slots.length);
  }

  /* ---------- layout helpers ---------- */
  var rows = [];   /* hit-test rows: {x,y,w,h,act,sel} rebuilt every frame */

  function menuRow(x, y, label, selected, color, heartOn) {
    var s = 2;
    var w = textW(label, s) + 30;
    if (heartOn) heart(x + 2, y + 3, 2, COL.red);
    text(label, x + 32, y, s, color || (selected ? COL.sel : COL.txt));
    rows.push({ x: x, y: y - 4, w: w + 40, h: 20, act: label, sel: selected });
    return y + 22;
  }

  function confirmBox(title, sub) {
    box(140, 170, 360, 130);
    text(title, 320 - textW(title, 2) / 2, 190, 2, COL.txt);
    if (sub) text(sub, 320 - textW(sub, 1) / 2, 216, 1, COL.hint);
    var y = 244;
    var opts = ["YES", "NO"];
    S.confirm.yesPos = [];
    for (var i = 0; i < opts.length; i++) {
      var x = 245 + i * 90;
      var on = (S.confirm.yes ? i === 0 : i === 1);
      if (on) heart(x - 4, y + 2, 2, COL.red);
      text(opts[i], x + 14, y, 2, on ? COL.sel : COL.txt);
      rows.push({ x: x - 10, y: y - 6, w: 80, h: 24, act: "confirm" + i, sel: on });
    }
  }

  /* ---------- draw ---------- */
  function drawMain() {
    var info = S.info;
    /* stats strip (like the in-game menu header) */
    if (info) {
      text(info.name, 36, 24, 2, COL.txt);
      text("LV " + info.lv, 36 + textW(info.name, 2) + 24, 24, 2, COL.txt);
      var hp = "HP " + info.hp + "/" + info.maxhp;
      text(hp, 36 + textW(info.name, 2) + textW("LV " + info.lv, 2) + 48, 24, 2, COL.txt);
      var badge = info.route;
      var bx = W - 36 - textW(badge, 2);
      text(badge, bx, 24, 2, routeColor(info.route));
      var loc = (info.boss ? info.boss + "  -  " : "") + info.area;
      text(loc, 36, 46, 1, COL.hint);
    }

    box(32, 84, 576, 262);
    text("PAUSED", 320 - textW("PAUSED", 3) / 2, 108, 3, COL.txt);

    var items = ["RESUME", "SAVE STATES", "FULLSCREEN", "QUIT"];
    var y = 158;
    for (var i = 0; i < items.length; i++) {
      y = menuRow(84, y, items[i], S.sel === i) + 8;
    }
    text("\u2191\u2193 SELECT   Z CONFIRM   X RESUME", 320 - textW("\u2191\u2193 SELECT   Z CONFIRM   X RESUME", 1) / 2, 368, 1, COL.hint);
  }

  function drawStates() {
    var info = S.info;
    text("SAVE STATES", 36, 20, 2, COL.txt);

    /* route filter tabs */
    var tx = 36;
    for (var t = 0; t < TABS.length; t++) {
      var on = S.tab === t;
      var tw = textW(TABS[t], on ? 2 : 1);
      text(TABS[t], tx, 42, on ? 2 : 1, on ? COL.sel : COL.hint);
      tx += tw + 26;
    }
    var autoOn = window.UndertaleBackups ? window.UndertaleBackups.auto() : false;
    var at = "AUTO " + (autoOn ? "ON" : "OFF");
    text(at, W - 36 - textW(at, 1), 46, 1, autoOn ? COL.auto : COL.hint);
    text("(ENTER TOGGLES)", W - 36 - textW("(ENTER TOGGLES)", 1), 58, 1, COL.hint);

    box(32, 74, 576, 330);

    /* NEW STATE row */
    var y = 92;
    y = menuRow(60, y, "NEW SAVE STATE", S.sel === 0, S.sel === 0 ? COL.sel : COL.txt, true) + 6;

    /* slot rows */
    var visible = Math.min(S.slots.length, 8);
    if (S.scroll > S.slots.length - visible) S.scroll = Math.max(0, S.slots.length - visible);
    var idx;
    for (var r = 0; r < visible; r++) {
      idx = S.scroll + r;
      var s = S.slots[idx];
      if (!s) break;
      var sel = S.sel === idx + 1;
      if (sel) heart(62, y + 3, 2, COL.red);
      var meta = s.meta || {};
      var rc = routeColor(meta.route);
      text((meta.route || "?").slice(0, 3), 92, y, 2, rc);
      var lx = 92 + textW("GEN", 2) + 14;
      var bossTxt = meta.boss || meta.area || "SAVE";
      text(bossTxt.slice(0, 18), lx, y, 2, sel ? COL.sel : COL.txt);
      var lvTxt = "LV" + (meta.lv || 1);
      text(lvTxt, 340, y, 2, sel ? COL.sel : COL.txt);
      var tTxt = new Date(s.id).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      text(tTxt, 400, y, 2, sel ? COL.sel : COL.hint);
      if (s.auto) text("AUTO", 470, y, 2, COL.auto);
      rows.push({ x: 56, y: y - 4, w: 440, h: 20, act: "slot" + idx, sel: sel });
      y += 22;
    }
    if (S.slots.length === 0) {
      text("NO STATES YET - PRESS Z TO MAKE ONE", 320 - textW("NO STATES YET - PRESS Z TO MAKE ONE", 1) / 2, 200, 1, COL.hint);
    }
    if (S.slots.length > 8) {
      var sc = "MORE " + (S.slots.length - 8);
      text(sc, 320 - textW(sc, 1) / 2, 372, 1, COL.hint);
    }

    var hint = "\u2190\u2192 ROUTE   \u2191\u2193 SELECT   Z RESTORE   D DELETE   X BACK";
    text(hint, 320 - textW(hint, 1) / 2, 414, 1, COL.hint);
    text("SHIFT CTRL E ANYWHERE FOR A QUICK BACKUP", 320 - textW("SHIFT CTRL E ANYWHERE FOR A QUICK BACKUP", 1) / 2, 428, 1, COL.hint);
  }

  function drawConfirm() {
    var c = S.confirm;
    if (c.kind === "restore") {
      var m = c.meta || {};
      var t = "RESTORE THIS SAVE STATE?";
      var sub = (m.route || "?") + (m.boss ? " - " + m.boss : "") + "  LV" + (m.lv || 1) +
                "  " + new Date(c.id).toLocaleString();
      confirmBox(t, sub);
    } else {
      confirmBox("DELETE THIS SAVE STATE?", new Date(c.id).toLocaleString());
    }
    var hint = "Z CONFIRM   X CANCEL";
    text(hint, 320 - textW(hint, 1) / 2, 320, 1, COL.hint);
  }

  function draw() {
    if (!ctx) return;
    rows = [];
    S.tick++;
    ctx.clearRect(0, 0, W, H);
    /* dim the frozen game behind us, exactly like the game fades dialogs */
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, H);
    if (S.mode === "main") drawMain();
    else if (S.mode === "states") drawStates();
    else drawConfirm();
  }

  function loop() {
    if (!S.open) return;
    placeCanvas();
    draw();
    raf = requestAnimationFrame(loop);
  }

  /* ---------- actions ---------- */
  function makeState() {
    if (window.UndertaleBackups) window.UndertaleBackups.make();
    refresh();
  }
  function doRestore() {
    var res = window.UndertaleBackups.restore(S.confirm.id);
    if (res && res.ok) {
      close();
      /* reload only after the IndexedDB writes settle - reloading sooner
         kills the transactions and the save-sync then drops the mirror */
      var go = function () { setTimeout(function () { window.location.reload(); }, 60); };
      if (res.idb && typeof res.idb.then === "function") res.idb.then(go, go);
      else go();
    }
  }
  function doDelete() {
    window.UndertaleBackups.del(S.confirm.id);
    S.confirm = null;
    S.mode = "states";
    refresh();
  }

  function confirmSel(i) {
    S.confirm.yes = i === 0;
  }
  function confirmGo() {
    if (S.confirm.yes) {
      if (S.confirm.kind === "restore") doRestore();
      else doDelete();
    } else {
      S.confirm = null;
      S.mode = "states";
    }
  }

  /* ---------- input ---------- */
  function mainAction(i) {
    if (i === 0) close();
    else if (i === 1) { S.mode = "states"; S.sel = 0; S.scroll = 0; refresh(); }
    else if (i === 2) { if (window.UndertaleBackups) window.UndertaleBackups.toggleFullscreen(); }
    else if (i === 3) {
      S.confirm = { kind: "quit", id: 0, yes: false };
      S.mode = "confirm";
    }
  }

  function statesUp() {
    S.sel = Math.max(0, S.sel - 1);
    if (S.sel < S.scroll) S.scroll = S.sel;
  }
  function statesDown() {
    S.sel = Math.min(S.slots.length, S.sel + 1);
    if (S.sel > S.scroll + 7) S.scroll = S.sel - 7;
  }
  function statesGo() {
    if (S.sel === 0) { makeState(); return; }
    var s = S.slots[S.sel - 1];
    if (!s) return;
    S.confirm = { kind: "restore", id: s.id, meta: s.meta, yes: true };
    S.mode = "confirm";
  }
  function statesDelete() {
    if (S.sel === 0) return;
    var s = S.slots[S.sel - 1];
    if (!s) return;
    S.confirm = { kind: "delete", id: s.id, meta: s.meta, yes: false };
    S.mode = "confirm";
  }

  var GAME_KEYS = {
    ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1,
    Enter: 1, z: 1, Z: 1, x: 1, X: 1, c: 1, C: 1,
    w: 1, W: 1, s: 1, S: 1, a: 1, A: 1, d: 1, D: 1,
    " ": 1, Shift: 1, Control: 1, Tab: 1
  };

  function onKey(e) {
    if (e.repeat) { if (S.open) e.preventDefault(); return; }
    if (!S.open) {
      if (e.key === "Escape" && !fullscreenElementActive()) {
        e.preventDefault();
        open();
      }
      return;
    }
    var k = e.key;
    var handled = true;
    if (S.mode === "main") {
      if (k === "ArrowUp" || k === "w" || k === "W") S.sel = (S.sel + 3) % 4;
      else if (k === "ArrowDown" || k === "s" || k === "S") S.sel = (S.sel + 1) % 4;
      else if (k === "Enter" || k === "z" || k === "Z" || k === " ") mainAction(S.sel);
      else if (k === "Escape" || k === "x" || k === "X") close();
      else handled = false;
    } else if (S.mode === "states") {
      if (k === "ArrowUp" || k === "w" || k === "W") statesUp();
      else if (k === "ArrowDown" || k === "s" || k === "S") statesDown();
      else if (k === "ArrowLeft" || k === "a" || k === "A") { S.tab = (S.tab + TABS.length - 1) % TABS.length; S.sel = 0; S.scroll = 0; refresh(); }
      else if (k === "ArrowRight" || k === "d" || k === "D") {
        if (S.sel > 0) statesDelete();       /* D on a slot = delete */
        else { S.tab = (S.tab + 1) % TABS.length; S.sel = 0; S.scroll = 0; refresh(); }
      }
      else if (k === "Enter") {
        if (S.sel === 0 && e.shiftKey === false && (e.ctrlKey || e.altKey)) {
          /* reserved - ignore */
        } else if (S.sel === 0) {
          /* Enter on the header row toggles auto-backup */
          if (window.UndertaleBackups) window.UndertaleBackups.auto(!window.UndertaleBackups.auto());
        } else statesGo();
      }
      else if (k === "z" || k === "Z" || k === " ") {
        if (S.sel === 0) {
          if (window.UndertaleBackups) window.UndertaleBackups.auto(!window.UndertaleBackups.auto());
        } else statesGo();
      }
      else if (k === "Escape" || k === "x" || k === "X") { S.mode = "main"; S.sel = 1; }
      else handled = false;
    } else {  /* confirm */
      if (k === "ArrowLeft" || k === "a" || k === "A") confirmSel(0);
      else if (k === "ArrowRight" || k === "d" || k === "D") confirmSel(1);
      else if (k === "Enter" || k === "z" || k === "Z" || k === " ") confirmGo();
      else if (k === "Escape" || k === "x" || k === "X") {
        if (S.confirm.kind === "quit") { S.confirm = null; S.mode = "main"; }
        else { S.confirm = null; S.mode = "states"; }
      }
      else handled = false;
    }
    if (handled || GAME_KEYS[k]) {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    }
  }

  function fullscreenElementActive() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  /* ---------- mouse ---------- */
  function onMouse(e) {
    if (!S.open || !canvas) return;
    var r = canvas.getBoundingClientRect();
    var x = (e.clientX - r.left) * W / r.width;
    var y = (e.clientY - r.top) * H / r.height;
    if (e.type === "mousemove") {
      for (var i = 0; i < rows.length; i++) {
        var w = rows[i];
        if (x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h) {
          if (S.mode === "main") S.sel = i;
          else if (S.mode === "states") {
            if (w.act === "NEW SAVE STATE") S.sel = 0;
            else if (w.act.indexOf("slot") === 0) S.sel = Number(w.act.slice(4)) + 1;
          } else if (S.mode === "confirm" && w.act.indexOf("confirm") === 0) {
            confirmSel(Number(w.act.slice(7)));
          }
          break;
        }
      }
    } else if (e.type === "click") {
      for (var j = 0; j < rows.length; j++) {
        var t = rows[j];
        if (x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h) {
          if (S.mode === "main") { S.sel = j; mainAction(j); }
          else if (S.mode === "states") {
            if (t.act === "NEW SAVE STATE") { S.sel = 0; makeState(); }
            else if (t.act.indexOf("slot") === 0) {
              S.sel = Number(t.act.slice(4)) + 1;
              statesGo();
            }
          } else if (S.mode === "confirm" && t.act.indexOf("confirm") === 0) {
            confirmSel(Number(t.act.slice(7)));
            confirmGo();
          }
          break;
        }
      }
    }
  }

  /* ---------- open/close ---------- */
  function open() {
    if (S.open) return;
    if (!ensureCanvas()) return;
    attachLazy();
    refresh();
    S.open = true;
    S.mode = "main";
    S.sel = 0;
    canvas.style.display = "block";
    cancelAnimationFrame(raf);
    loop();
    if (typeof window.__utPauseHook === "function") window.__utPauseHook();
  }
  function close() {
    if (!S.open) return;
    S.open = false;
    cancelAnimationFrame(raf);
    if (canvas) canvas.style.display = "none";
    if (typeof window.__utResumeHook === "function") window.__utResumeHook();
  }
  function isOpen() { return S.open; }

  /* listeners: the keydown stays live (opens the menu) but the mouse/blur
     listeners are only attached while the menu is open - the runner's boot
     is timing-sensitive and every extra capture listener counts */
  window.addEventListener("keydown", onKey, true);
  var lazyAttached = false;
  function attachLazy() {
    if (lazyAttached) return;
    lazyAttached = true;
    window.addEventListener("mousemove", onMouse, true);
    window.addEventListener("click", onMouse, true);
    window.addEventListener("resize", placeCanvas);
    window.addEventListener("blur", function () { if (S.open) close(); });
  }

  window.UTPauseMenu = { open: open, close: close, isOpen: isOpen, toggle: function () { S.open ? close() : open(); } };
  window.togglePauseMenu = window.UTPauseMenu.toggle;
})();

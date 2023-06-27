// change the following content of the bundle.js <https://dbosst.github.io/gameclock-demo/demo/bundle.js>
// this.handleTenCount=this.handleTenCount.bind(this),this.logEvent=this.logEvent.bind(this),
// v
// this.handleTenCount=this.handleTenCount.bind(this),globalThis.app=this,globalThis?.injectTrigger?.call(),this.logEvent=this.logEvent.bind(this),

globalThis.injectTrigger=()=>{
    console.log('inject trigger run')
    app.handleTenCount=()=>{console.log('10 '+Math.random())}
    app.setState(
        {"adjustAction":"setElapsedPeriodTime","adjustEventID":null,"adjustPlayerID":"black","adjustVal":"0","clockMode":"byo-yomi","dispInfoNumPeriods":true,"dispInfoPeriodMoves":false,"dispInfoPlayerText":true,"dispCountElapsedMainTime":false,"dispCountElapsedNumPeriods":false,"dispCountElapsedPeriodMoves":false,"dispCountElapsedPeriodTime":false,"dispFormatMainTimeFSNumDigits":1,"dispFormatMainTimeFSLastNumSecs":10,"dispFormatMainTimeFSUpdateInterval":0.1,"dispFormatPeriodTimeFSNumDigits":1,"dispFormatPeriodTimeFSLastNumSecs":10,"dispFormatPeriodTimeFSUpdateInterval":0.1,"dispOnExpired":"OT","gameClockID":"demo","mode":"reset","minActiveClocks":2,"numMoves":0,"initialTime":[{"playerID":"black","playerText":"   ","mainTime":60,"numPeriods":3,"periodTime":20,"periodMoves":1,"mainMoves":0},{"playerID":"white","playerText":"   ","mainTime":60,"numPeriods":3,"periodTime":20,"periodMoves":1,"mainMoves":0}],"eventLog":"","eventLogEnabled":false,"numPlayers":2,"playerIcons":"../assets/demo/","splitPlayerClocks":true}
    )

    let injectcsstext =/* css */`
        .targetdiv_playerclock{
            position:fixed;
            top:0;
        }
        .gameclock_demo{
            height:100vh;
            width:50vw;
            font-size:5vh;
            text-align:center;
            line-height:0vh;
        }
        #targetdiv_playerclock_demo_black{
            left:0
        }
        #targetdiv_playerclock_demo_white{
            left:50vw
        }
        #playerclock_demo_black_M{
            
        }
        #playerclock_demo_white_M{

        }
        .insertbutton{
            display:block;
            position:fixed;
            top:1vh;
            width:9vw;
            height:9vh;
        }
        .insertbuttonpause{
            left:40vw;
        }
        .insertbuttonesc{
            left:51vw;
        }
    `
    document.head.insertAdjacentHTML('beforeend','<style id="injectcss">'+injectcsstext+'</style>')
    document.body.insertAdjacentHTML('beforeend','<button class="insertbutton insertbuttonpause" type="button" title="||" onclick="globalThis.insertbuttonpause()">||</button><button class="insertbutton insertbuttonesc" type="button" title="*" onclick="globalThis.insertbuttonesc()">*</button>')
    globalThis.insertbuttonpause=function () {
        if (!Array.from(playerclock_demo_black_M.classList).includes('running') && !Array.from(playerclock_demo_white_M.classList).includes('running')) {
            document.querySelector('[title="Resume"]').click()
        } else {
            document.querySelector('[title="Pause"]').click()
        }
    }
    globalThis.insertbuttonesc=function () {
        injectcss.innerHTML=injectcss.innerHTML?'':injectcsstext
    }
    function clickdiv(player01) {
        if (app.state.numMoves%2===player01) {
            document.querySelector('[title="Make Move"]').click()
        }
    }

    setTimeout(() => {
        // document.querySelector('[title="Pause"]').click()
        // document.querySelector('[title="Resume"]').click()
        document.querySelector('[title="Reset"]').click()
        // document.querySelector('[title="Make Move"]').click()

        targetdiv_playerclock_demo_black.onclick=()=>{
            clickdiv(0)
        }
        targetdiv_playerclock_demo_white.onclick=()=>{
            clickdiv(1)
        }
    }, 0);
}

globalThis?.app?globalThis.injectTrigger():0;


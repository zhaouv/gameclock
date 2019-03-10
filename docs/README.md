# Documentation

This page contains information for developers that want to incorporate the gameclock module into their program.

## About gameclock

The gameclock is a timer that supports an arbitrary number of players. It is licensed under the MIT license. The gameclock module is written for [Preact](https://preactjs.com/), but should work with [React](https://reactjs.org). The demo, however, has been written specifically for preact.

___

## Installation

Assuming you must have npm, preact,  and your bundler set up, use npm to install the module:

~~~
$ npm install @dbosst/gameclock
~~~

To use this module, require it as follows:

~~~js
const {h} = require('preact')
const {gameclock} = require('@dbosst/gameclock')
~~~

Define variables with at least the minimum required props: `clockMode`, `mode`, `numMoves` and `initialTime`

You can then load the component (preact style) in your component's render():
~~~js
h(gameclock, {
    clockMode: clockMode,
    mode: mode,
    numMoves: numMoves,
    initialTime: initialTime,
})
~~~

Please make sure to include the `css/gameclock.css` file in your HTML:

~~~html
<link rel="stylesheet" href="path/to/gameclock-module/css/gameclock.css"/>
~~~

___

## Component overview
There are two components to the module: the main module `gameclock` and its component `playerclock`. `gameclock` is responsible for loading one `playerclock` for each player, and is mainly responsible for controlling which `playerclock` is active. It also calculates the (estimated) player clock display width, as well as passes information to clocks in the case of manually adjusting a `playerclock`, or, as in the case of hourglass mode, passing information between `playerclock`s.

## Limitations
Will display any time up to 9007199254740992 seconds (2^52 seconds, or ~286 million years)

Preact has a limitation of not being able to return document fragments (at least as of yet), so at the moment all player clocks are bundled inside a div in gameclock. If this changes, in the future we may be able to simply return an array of document fragments (each containing a player clock). For now this is not possible, and to separate them requires a bit of javascript 'hacking' (see the demo's split player clock's code).

## Clock display
The clock displays in order of:

{playerText} ({period/phase #}) {period/phase move #} {delay time} {phase/main/period time}

The time displayed is in `hours:minutes:seconds{:fractional-seconds}` where fractional seconds means the seconds can be shown with up to 4 decimal places. The time shown is always truncated to however many decimal places shown (not rounded). So, 0.04959 seconds will shown as `0` or `0.0` or `0.04` or `0.049` or `0.0495` for 0-4 decimal places shown, respectively.

Any of the fields except the time can be configured to displayed or not. The delay time is only (and always) shown in the 'delay' `clockMode`

___

## DOM

The gameclock and each playerclock is assigned multiple classnames for css styling. The text in braces refers to the corresponding prop given to gameclock props.

Each player clock is given the following class names depending on the state:
* gameclock_{gameClockID}
* playerclock
* playerclock_{gameClockID}_{playerID}
* expired
* running
* infinitetime
* paused
* inactive

The game clock is given the following classnames:
* gameclock
* gameclock_{gameClockID}

Additionally the gameclock div has the following attributes:
* 'id': gameclockid_{gameClockID}
* 'data-numActive': the number of active clocks (not expired)
* 'data-numClocks': the total number of player clocks (expired or not)

___

## Styling

There are many variables that can be overriden to customize the look. For instance, changing the .gameclock variable `--gameclock-display-direction` to `row` will change the clocks from vertically stacked to horizontally stacked.

Please see the [gameclock.css](../css/gameclock.css) for ideas.

A note on graphemes: the gameclock tries to keep the all the player clock's the same size by calculating how big the timer should be (this can't be done for increment modes since an infinite amount of time can be theoretically gained). This includes calculating the width of the `playerText` which is done using the npm package `grapheme-splitter` for better international support. However, for it to work properly, the "width" of what we would a character or, more properly, a grapheme, changes depending on which font you use. So if you wish to use playerText that has graphemes that are multiple bytes you should make sure you override the font-face chosen with a fixed-width font that displays each grapheme as one actual character (i.e. one that grapheme-splitter will count correctly).

___

## gameClock props

The following list contains all props for the `gameclock` component, grouped according to function (as in the demo).  Bold indicates a required prop for any clockMode. The accepted types and values are listed after each `:`.

### Manual player clock adjustment

* adjustAction: `String`
    - see how to in the [adjusting the clock during play](#adjusting-the-clock-during-play) section
* adjustEventID: `Integer`
* adjustPlayerID: `String`
* adjustVal: `Float` or `Integer`

### Display formatting
* dispInfoNumPeriods: `Boolean`
* dispInfoPeriodMoves: `Boolean`
* dispInfoPlayerText: `Boolean`
* dispCountElapsedMainTime: `Boolean`
* dispCountElapsedNumPeriods: `Boolean`
* dispCountElapsedPeriodMoves: `Boolean`
* dispCountElapsedPeriodTime: `Boolean`
* dispFormatMainTimeFSNumDigits: `Integer`
* dispFormatMainTimeFSLastNumSecs: `Integer`
    - `0` to disable, otherwise any positive integer (normally, like 5, 10, 20, 30, or 60)
* dispFormatMainTimeFSUpdateInterval: `Float`
    - `1` - if dispFormatMainTimeFSNumDigits is `0`
    - `0.1` suggested if dispFormatMainTimeFSNumDigits is `1`
    - `0.02` suggested if dispFormatMainTimeFSNumDigits is `2`, `3`, or `4`, because normally 60 fps is the limit
* dispFormatPeriodTimeFSNumDigits: `Integer`
* dispFormatPeriodTimeFSLastNumSecs: `Integer`
* dispFormatPeriodTimeFSUpdateInterval: `Float`
* dispOnExpired: `String` or `null`
    - Any short string, such as 'OT' or 'Expired'
    - `null` - if you want to display the time instead of a string (in this case you need css or callback events to know the expired state of a clock)

### Clock settings
* clockMode: `String`
    - See the [clockMode prop](#clockmode-prop) section
* gameClockID: `String`
    - a short, unique string for the css (in case for whatever reason, you need multiple game clocks)
* minActiveClocks: `Integer`
    - usually set to the number of player clocks you have (which is 2 normally, as in go & chess). This number determines how many player clocks must not be in the expired state for other clocks to continue run, i.e. if you have 10 players and you want to stop all the clocks once you have a total of three player's clock expire, this would be set to 8.
* mode: `String`
    - 'init'
        - set to init when all other options have been set
    - 'pause'
    - 'resume'
    - 'reset'
        - to reset all player clocks to their initial state and time
* numMoves: `Integer`
    - `0` - start with `0` and increment by 1 to change to the next active player
* initialTime: `Array` of `Object`
    - See the [initialTime prop](#initialtime-prop) section

### Callback event handlers
* handleAdjust: `Function` reference
    - Called after a manual adjustment has been made. See the [callback events](#callback-events) section
* handleElapsedMainTime: `Function` reference
    - Called when the main time ends, and when a phase ends in `clockMode` 'incrementBefore', 'incrementAfter' and 'delay' - this is when 'mainTime' 'secondaryTime' or 'tertiaryTime' ends.
* handleElapsedPeriod: `Function` reference
    - Called when: in `clockMode` 'byo-yomi' when a period ends, or `clockmode` 'delay` when the delay ends.
* handleInit: `Function` reference
    - called automatically whenever player clocks are initialized (from changing the initialTime or other core settings)
* handleMadeMove: `Function` reference
* handlePaused: `Function` reference
    - Called whenever the playerclock is paused (either manually or from changing turns) (may fire more than once)
* handlePlayerClockExpired: `Function` reference
* handleReset: `Function` reference
    - Called when a reset is performed, which is when both `numMoves` is set to 0 and `mode` is set to 'reset'
* handleResumed: `Function` reference
    - Called whenever the playerclock is resumed (either manually or from changing turns)
* handleTenCount: `Function` reference
    - Called when there becomes 10 seconds (or less) left in the phase/main time or period time. If a `periodTime` or phase/main time is set to say 5 seconds, it will still be called when that period/phase starts with 5 seconds.
* handleUpdated: `Function` reference
    - Only useful for the split player clocks hack (called whenever a playerclock is updated)

___

## clockMode prop

In only the increment/delay modes, phase refers to in the prop `initialTime` either the `mainTime`, `secondaryTime`, or `tertiaryTime` (i.e., three different sets of main time)

* 'absolutePerPlayer' - Each player is given `mainTime` before their time expires.
* 'byo-yomi' - Each player is given main time. When the main time runs out they enter byo-yomi/overtime, where they have `periodTime` to make `periodMoves` before the period elapses, of which they have `numPeriods` before their time expires.
* 'delay' - Each player is given main time and optioanlly secondary time and optionally a tertiary time (three phases of time). When each player's turn comes up they have `periodTime` before their clock's (phase) time starts running. If the player makes `periodMoves` for that phase then the time left for that phase's main time is spilled over (added) to the next phases available time.  When one phases' time runs out, the clock advances to the next phase. The clock expires when all phases' time expire.
* 'incrementAfter' - Immediately after each player makes a move, `periodTime` is added to that player's clock. `periodTime` is also added to each player's clock on initialization/reset. Otherwise it operates similarly to 'delay'.
* 'incrementBefore' - Immediately before each player's turn, `periodTime` is added to that player's clock. Otherwise it operates similarly to 'delay'.
* 'hourglass' - Each player starts with `mainTime` and the active time elapsed during that player's turn is then given to the next player. For example, if you use five seconds of time to make a move, your opponent will gain five seconds thinking time for the next move.
* 'wordgame' - Each player starts with `mainTime` and when the time runs out, the clock does not expire, but instead starts counting negative time.

___

## initialTime prop

`initialTime` is an `Array` of `Object` where each `Object` will hold the time settings for each player's clock. To keep the number of props small, byo-yomi and the increment/delay modes share props.

* playerID: `String` - a short string, all lowercase, unique to each player (should have no spaces or special characters since it will be used as in the CSS classnames), i.e. 'b', or 'w', or '1' or '2' -- if its a number it still must be represented as a string.
* playerText: `String` or `null` - an optional short string to display at the beginning of each player clock display, i.e. 'Black' or 'White'
* mainTime: `Float` the main time in seconds for all modes, set to 0 if you do not want a main time, i.e. for byo-yomi you may not want any main time.
* mainMoves: `Integer` for `clockMode` delay and increment, the number of moves that must be made within the alotted time before advancing to the secondaryTime phase. If all remaining moves must be made within this phase (this is the last phase) or if you don't need this since you are using a different clockMode set this to `0`.
* secondaryTime: `Float` the second phase time in seconds, only used for `clockMode` delay and increment; set to `0` if you do not want a second phase of time or are using a different `clockMode`.
* secondaryMoves: `Integer` for `clockMode` delay and increment, the number of moves that must be made within the alotted time before advancing to the tertiaryTime phase. If all remaining moves must be made within this phase (this is the last phase) or if you don't need this since you are using a different clockMode set this to `0`.
* tertiaryTime: `Float` the second phase time in seconds, only used for `clockMode` delay and increment; set to `0` if you do not want a second phase of time or are using a different `clockMode`.
* tertiaryMoves: `Integer` for `clockMode` delay and increment, the number of moves that must be made within the alotted time before advancing to the tertiaryTime phase. If all remaining moves must be made within this phase (this is the last phase) or if you don't need this since you are using a different clockMode set this to `0`.
* numPeriods: `Integer` for `clockMode` byo-yomi only. The number of byo-yomi periods that must elapse before the player's time expires. Set this to '0' if you are not using byo-yomi.
* periodTime: `Integer
    - for `clockMode` byo-yomi, this corresponds to the amount of time in each period
    - for `clockMode` delay and increment, this corresponds to the bonus time given for every move from the first move.
* periodMoves: `Integer
    - for `clockMode` byo-yomi, this corresponds to the # of moves that must be made in the current period before the elapsedPeriodTime is reset. For real byo-yomi this is usually 1. For canadian overtime this can be any positive number, i.e. 10, where you must make 10 moves within the periodTime for the elapsed period time to reset to 0.
    - for `clockMode` delay and increment, this corresponds to the bonus time given for every move from the first move.

___

## Making a move or changing the current player clock
To make a move (change the player's turn) you simply increment the `numMoves` property by one.

You can also change the current player's turn the same way by pausing (setting `mode` to 'paused'

___

## Callback events
With the exception of `handleAdjust` (which additionally returns an `adjustmentEventID`) and handleUpdated (which returns nothing), all other events return an object with the following keys:
* 'playerID' - a `String` that refers to symbolically the player whose turn just ended from making a move, corresponding to the `playerID` for the player's clock in `initialTime`
* 'clock' - an `Object` that is the playerclock state, see the [clock state](#clock-state) section
* 'activePlayers' - an `Array` of `String`. The string is a corresponding `playerID`. Only contains clocks that are not expired (when a clock is expired, it is removed from the array). The order shows the turns for each player clock, i.e., the first in the array is either that player's current turn or will soon be their turn, and depends on the event type and player clock states:
    - for `madeMove`, which fires after the player who made a move's clock stops, usually the `playerID` will appear last in the array and the first will be the player whose turn is immediately next
    - after the time expires, i.e. for `handleExpired`, the first will be the player whose turn would be next (if the game has not ended)

___

## Clock state
Most events return an object called `clock` that is a single playerclock's state. Any time that elapses never includes time where the clocks are paused (such as with a manual pause of the clock).

* didTenCount: `Boolean`
    - Used only internally to track when the ten count has elapsed.
* elapsedMainTime: `Float`
    - The # of seconds elapsed for the current main time or the current phase for `clockMode` delay and increment.
* elapsedMoveTime: `Float`
    - The # of seconds elapsed since the start of a player's turn and is reset ONLY if the player makes a move when their clock is running. In other words, for example, if player Black's clock has been running for 5 minutes, the gameclock is then manually paused, then the `numMoves` is incremented to switch to the player White, the gameclock is manually resumed, and then White makes a move and so it becomes Black's turn again, the elapsedMoveTime continues to increment from where it left off for Black at 5 minutes. If you want different behavior, then you need to manually adjust the clock state, see the [Adjusting the clock during play](#adjusting-the-clock-during-play) section.
* elapsedNumPeriods: `Integer`
    - For `clockMode` byo-yomi it is the total number of periods elapsed. For `clockMode` delay or increment
* elapsedTotalTime: `Float`
    - The total time elapsed for the current player clock (including all periods/phases/delays/increments etc.), i.e. the time the player spent thinking
* elapsedPeriodMoves: `Integer`
    - The # of moves made by a single player in the current period or phase. Note: in increment and delay `clockMode` when this # exceeds the `initialTime` `periodMoves` it will only show on the clock display up to the `initialTime` `periodMoves` and not the actual, since in these modes for chess we ostensibly only care if we reach the required number of moves for that phase, not if we go beyond it for the last phase.
* elapsedPeriodTime: `Float`
    - The time elapsed in seconds since the start of the period. More time can be given for the current period than is available from the initialTime settings by making the value more negative.
* needIncrementBefore: `Boolean`
    - Used only internally by the playerclock for increment mode - not meaningful outside.
* resetPeriod: `Boolean`
    - Used only internally by the playerclock for making sure time is adjusted properly after making a move - not meaningful outside.
* state: `String`
    - 'running'
        - set the clock is currently counting down time
    - 'paused'
        - set when the clock is manually paused or it is no longer the player's turn
    - 'init'
        - set after correctly setting the gameclock props and it's `mode` to 'init'
    - 'preinit'
        - the default when the clock has not yet been initialized (i.e. after mounting the component)

___

## Adjusting the clock during play
You can adjust any player clock state during play, by first pausing and then simultaneously setting the following props. When you receive the callback through `handleAdjust` corresponding to the `eventID` you are waiting for you can then safely resume.

* adjustAction - setElapsed... sets the value to `adjustVal` and incrElapsed... adds the current value by `adjustVal`. It's possible to have negative values for the time. See the [clock state](#clock-state) section for info about what these mean.
    - 'incrElapsedMainTime'
    - 'incrElapsedNumPeriods'
    - 'incrElapsedPeriodMoves'
    - 'incrElapsedPeriodTime'
    - 'incrElapsedTotalTime'
    - 'setElapsedMainTime'
    - 'setElapsedNumPeriods'
    - 'setElapsedPeriodMoves'
    - 'setElapsedPeriodTime'
    - 'setElapsedTotalTime'
* adjustEventID - a counter which must be set initially to `0` for the first adjustment, and then incremented by 1 for every subsequent adjustment.
* adjustPlayerID - the string corresponding to player ID's player clock you want to adjust
* adjustVal: for Time a `Float` seconds (that can be negative to give the player time) and an `Integer` for numMoves, or numPeriods (which for delay mode corresponds to which phase we are in)

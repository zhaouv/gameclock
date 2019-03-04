# Documentation

This page contains information for developers that want to incorporate the gameclock module into their program.

## About gameclock

The gameclock is a timer that supports an arbitrary number of players. It is licensed under the MIT license. The gameclock module is written for [Preact](https://preactjs.com/), but should work with [React](https://reactjs.org). The demo, however, has been written specifically for preact.

### Installation

Assuming you must npm, preact and the bunlder installed, use npm to install the module:

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

## Component overview
There are two components to the module: the main module `gameclock` and its component `playerclock`. `gameclock` is responsible for loading one `playerclock` for each player.

Preact has a limitation of not being able to return document fragments (at least as of yet), so at the moment both player clocks are bundled inside a div in gameclock. If this changes, in the future we may be able to simply return an array of document fragments (each containing a player clock). For now this is not possible, and to separate them requires a bit of javascript 'hacking' (see the demo's split player clock's code).

## Clock display
The clock displays in order of:

{playerText} ({period/phase #}) {period/phase move #} {delay time} {phase/main/period time}

The time shown is always truncated to however many decimal places shown (not rounded). So, 0.04959 seconds will shown as `0` or `0.0` or `0.04` or `0.049` or `0.0495` for 0-4 decimal places shown, respectively.

Any of the fields except the time can be configured to displayed or not. The delay time is only (and always) shown in the 'delay' `clockMode`

## Styling

## gameClock props

## clockMode prop

In only the increment/delay modes, phase refers to in the prop `initialTime` either the `mainTime`, `secondaryTime`, or `tertiaryTime` (i.e., three different sets of main time)

* `absolutePerPlayer` - Each player is given `mainTime` before their time expires.
* `byo-yomi` - Each player is given main time. When the main time runs out they enter byo-yomi/overtime, where they have `periodTime` to make `periodMoves` before the period elapses, of which they have `numPeriods` before their time expires.
* `delay` - Each player is given main time and optioanlly secondary time and optionally a tertiary time (three phases of time). When each player's turn comes up they have `periodTime` before their clock's (phase) time starts running. If the player makes `periodMoves` for that phase then the time left for that phase's main time is spilled over (added) to the next phases available time.  When one phases' time runs out, the clock advances to the next phase. The clock expires when all phases' time expire.
* `incrementAfter` - Immediately after each player makes a move, `periodTime` is added to that player's clock. `periodTime` is also added to each player's clock on initialization/reset. Otherwise it operates similarly to 'delay'.
* `incrementBefore` - Immediately before each player's turn, `periodTime` is added to that player's clock. Otherwise it operates similarly to 'delay'.
* `hourglass` - Each player starts with `mainTime` and the active time elapsed during that player's turn is then given to the next player. For example, if you use five seconds of time to make a move, your opponent will gain five seconds thinking time for the next move.
* `wordgame` - Each player starts with `mainTime` and when the time runs out, the clock does not expire, but instead starts counting negative time.

## initialTime prop

## making a move

## adjusting the clock

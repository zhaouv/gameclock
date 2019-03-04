# gameclock

A preact module for a game clock, supporting an arbitrary number of players.

## Demo

[View the live demo by clicking here.](https://dbosst.github.io/gameclock-demo/demo/index.html)

Note: the interface options for the clock are only part of the demo, not the module itself. Also, the images inside each player's clock are part of the demo css, not a module option.

You can also just use the demo for your personal needs (if you aren't attaching the module to a program), and save your own timing presets to a text file by copy/pasting the state with the demo's import/export feature.

## Features

Support for various timing modes:
* Go's byo-yomi / (Canadian) overtime
* Chess' Delay (Bronstein) Timing
* Chess' Increment (Fischer) Timing (before & after)
* Hourglass
* Word game timing (negative time counting)
* Absolute (egg-timer)

Customizable display:
* Display elapsed or remaining time/periods/phase/moves
* Customizable display text & information (player name, time expired text, periods, etc.)
* Fractional seconds customization (0-5 decimal places, update interval)

Adjustable clock:
* Pause the clock first, and adjust the current player clock.
* Also change the active player by pausing and making a move. You can adjust any player's clock this way.

Callback events, including:
* On last 10 seconds (of current period/phase)
* Time Expired
* Made move
* Pause, Resume, Reset, Init

CSS classes:
* Style the game clock or each individual player clock
* Style each player clock accordiong to the clcok state: expired, running, paused, init.

## Documentation
[Please the docs by clicking here.](docs/README.md)

## Build the demo
Pre-requisites: You need Node.js & npm installed to build the demo.

Then download this demo with `git` and use `npm` to install the dependencies:

~~~
$ git clone https://github.com/dbosst/gameclock
$ cd gameclock
$ npm install
~~~

Then to create the bundle, you can either build the development demo once:

~~~
$ npm run build-demo
~~~

Or use the `watch-demo` script for development:

~~~
$ npm run watch-demo
~~~

To view the built demo, open the local `gameclock/demo/index.html` file in your web browser.  If you have a javascript blocking plug-in, such as No-Script, make sure to allow for it.

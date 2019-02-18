const {createElement: h, Component} = require('preact')
const classnames = require('classnames')

const playerclock = require('./playerclock')
const helper = require('../src/helper.js')

class gameclock extends Component {
    constructor(props) {
        super(props)
        this.state = {
            activePlayers: null,
            doReset: false,
            fixedWidth: null,
            initialTime: null,
            numMovesPerPlayer: null,
            prevPlayer: null
        }

        this.calcFixedClockWidth = this.calcFixedClockWidth.bind(this)

        this.getActivePlayers = this.getActivePlayers.bind(this)
        this.getInitActivePlayers = this.getInitActivePlayers.bind(this)
        this.getNumMovesPerPlayer = this.getNumMovesPerPlayer.bind(this)

        this.initActivePlayers = this.initActivePlayers.bind(this)
        this.initNumMovesPerPlayer = this.initNumMovesPerPlayer.bind(this)

        this.handleInit = this.handleInit.bind(this)
        this.handleMadeMove = this.handleMadeMove.bind(this)
        this.handlePaused = this.handlePaused.bind(this)
        this.handlePlayerClockExpired = this.handlePlayerClockExpired.bind(this)
        this.handleReset = this.handleReset.bind(this)
        this.handleResumed = this.handleResumed.bind(this)
    }

    calcFixedClockWidth(props) {
        // calculate the max width of the player clock (div playerclockinner)
        // this way the clock width won't change after init

        if (props.initialTime == null || props.initialTime.length == 0) {
            return 0
        }

        // calculate from all disp options, initialTime, mode
        let widthPlayer
        if (props.dispInfoPlayerText === true) {
            let maxPlayerTextLen = props.initialTime.reduce(
                (max, t) => {
                    return (t.playerText ?
                        Math.max(max, helper.strlen(t.playerText)) :
                        max)
                }, 0)
            // add the playerText and trailing space
            widthPlayer = maxPlayerTextLen + 1
        } else {
            widthPlayer = 0
        }

        let mainTimeWidth

        // calculate max main time
        let maxMainTime = props.initialTime.reduce(
            (max, t) => Math.max(max, t.mainTime), 0)

        if (maxMainTime > 0) {
            if (props.dispFormatMainTimeFSNumDigits > 0) {
                mainTimeWidth = helper.strlen(helper.timeToString(
                        maxMainTime,
                        null,
                        props.dispFormatMainTimeFSNumDigits,
                        true
                    ))
            } else {
                mainTimeWidth = helper.strlen(helper.timeToString(maxMainTime))
            }
        } else {
            mainTimeWidth = 0
        }

        let periodDispWidth = 0
        if (props.clockMode === 'byo-yomi') {
            // calculate max period time
            let maxPeriodTime = props.initialTime.reduce(
                (max, t) => Math.max(max, t.periodTime), 0)

            if (maxPeriodTime > 0) {
                if (props.dispFormatPeriodTimeFSNumDigits > 0) {
                    periodDispWidth += helper.strlen(
                        helper.timeToString(
                            maxPeriodTime,
                            null,
                            props.dispFormatPeriodTimeFSNumDigits,
                            true
                        ))
                } else {
                    periodDispWidth += helper.strlen(
                        helper.timeToString(maxPeriodTime))
                }

                if (props.dispInfoNumPeriods === true) {
                    // calc max num periods
                    let maxNumPeriods = props.initialTime.reduce(
                        (max, t) => Math.max(max, t.numPeriods), 0)
                    // including parenthesis and trailing space
                    periodDispWidth += 3 + helper.strlen(String(maxNumPeriods))
                }
                // usually client will set false when periodMoves = 1
                if (props.dispInfoPeriodMoves === true) {
                    // calc max period moves
                    let maxPeriodMoves = props.initialTime.reduce(
                        (max, t) => Math.max(max, t.periodMoves), 0)
                    // include two trailing spaces
                    periodDispWidth += 2 + helper.strlen(String(maxPeriodMoves))
                }
            }
        }

        let expiredWidth = props.dispOnExpired != null ?
            helper.strlen(String(props.dispOnExpired)): 0

        // always let time be at least width 1 (for time == 0)
        let maxWidth = widthPlayer +
            Math.max(1, mainTimeWidth, periodDispWidth, expiredWidth)

        return maxWidth
    }

    getActivePlayers({nstate = this.state} = {}) {
        // deep copy for Active Players
        return JSON.parse(JSON.stringify(nstate.activePlayers))
    }

    getNumMovesPerPlayer({nstate = this.state} = {}) {
        // deep copy for numMovesPerPlayer
        return JSON.parse(JSON.stringify(nstate.numMovesPerPlayer))
    }

    getInitActivePlayers({initialTime = null, numMoves = null, nstate = this.state} = {}) {
        // Enumerate activePlayers from 1 to number of players
        let numPlayers = ((initialTime != null) && (initialTime.length > 0)) ?
            initialTime.length : 0
        let activePlayers = null
        if (numPlayers > 0) {
            activePlayers = initialTime.map((k, v) => k.playerID)

            this.initNumMovesPerPlayer({
                initialTime: initialTime,
                nstate: nstate
            })
            // handle rotate player from numMoves
            // so we can change the first player pre-init
            if (numMoves != null && numMoves > 0) {
                let shiftAmount = numMoves % numPlayers
                let i
                let x
                for (i = 0; i < shiftAmount; i++) {
                    let x = activePlayers.shift()
                    activePlayers.push(x)
                }
            }
        } else {
            this.initNumMovesPerPlayer({
                initialTime: initialTime,
                nstate: nstate
            })
        }
        return activePlayers
    }

    initActivePlayers({initialTime = null, numMoves = null, nstate = this.state} = {}) {
        if (initialTime != null && initialTime.length > 0) {
            let activePlayers = this.getInitActivePlayers({
                initialTime: initialTime,
                numMoves: numMoves,
                nstate: nstate
                })
            nstate.activePlayers = activePlayers,
            nstate.prevPlayer = null
        } else {
            nstate.activePlayers = null
            this.initNumMovesPerPlayer({nstate: nstate})
        }
    }

    initNumMovesPerPlayer({initialTime = null, nstate = this.state} = {}) {
        // Initialize numMovesPerPlayer to 0 for each player (indexed 0)
        if (initialTime != null && initialTime.length > 0) {
            nstate.numMovesPerPlayer =
                initialTime.reduce((acc, v) => {
                    acc[v.playerID] = 0
                    return acc
                }, {})
        } else {
            nstate.numMovesPerPlayer = null
        }
    }

    handleInit({playerID = null, clock = null} = {}) {
        if (this.props.handleInit != null) {
            this.props.handleInit({clock: clock, playerID: playerID})
        }
    }

    handleMadeMove({playerID = null, clock = null} = {}) {
        if (this.props.handleMadeMove != null) {
            this.props.handleMadeMove({clock: clock, playerID: playerID})
        }
    }

    handlePaused({playerID = null, clock = null} = {}) {
        if (this.props.handlePaused != null) {
            this.props.handlePaused({clock: clock, playerID: playerID})
        }
    }

    handlePlayerClockExpired({playerID = null, clock = null} = {}) {
        // remove player from activePlayers
        if (this.state.activePlayers == null) {
            return
        }
        if (this.state.activePlayers.indexOf(playerID) == -1) {
            return
        }
        let prevPlayer
        let activePlayers = this.getActivePlayers({nstate: this.state})

        if (activePlayers != null) {
            prevPlayer = activePlayers[0]
            activePlayers.shift()
        } else {
            prevPlayer = 0
        }

        this.setState({
            prevPlayer: prevPlayer,
            activePlayers: activePlayers
        })

        if (this.props.handlePlayerClockExpired != null) {
            this.props.handlePlayerClockExpired({
                clock: clock,
                playerID: prevPlayer,
                nextPlayer: activePlayers[0]
            })
        }
    }

    handleReset({playerID = null, clock = null} = {}) {
        this.setState({
            doReset: false
        })
        if (this.props.handleReset != null) {
            this.props.handleReset({clock: clock, playerID: playerID})
        }
    }

    handleResumed({playerID = null, clock = null} = {}) {
        if (this.props.handleResumed != null) {
            this.props.handleResumed({clock: clock, playerID: playerID})
        }
    }

    componentDidMount() {
        let nstate = helper.deepCopyIfSame({nstate: this.state, pstate: this.state})
        nstate.fixedWidth = this.calcFixedClockWidth(this.props)
        this.initActivePlayers({
            initialTime: this.props.initialTime,
            numMoves: this.props.numMoves,
            nstate: nstate
        })
        this.setState({
            activePlayers: nstate.activePlayers,
            fixedWidth: nstate.fixedWidth,
            initialTime: nstate.initialTime,
            numMovesPerPlayer: nstate.numMovesPerPlayer,
            prevPlayer: nstate.prevPlayer
        })
        this.props.handleUpdated()
    }

    componentDidUpdate() {
        this.props.handleUpdated()
    }

    componentWillReceiveProps(nextProps) {
        let nstate = this.state

        let initStaged = (nextProps.mode === 'init' ||
            (this.props.mode === 'init' && nextProps.mode !== 'reset'))
        let timeChanged = !helper.shallowEquals(
            nextProps.initialTime, this.props.initialTime)
        let madeMove = (nextProps.numMoves !== this.props.numMoves)
        let modeChanged = (this.props.mode !== nextProps.mode)
        let clockModeChanged = (this.props.clockMode !== nextProps.clockMode)

        let dispChanged = (nextProps.dispInfoNumPeriods !== this.props.dispInfoNumPeriods) ||
            (nextProps.dispInfoPeriodMoves !== this.props.dispInfoPeriodMoves) ||
            (nextProps.dispInfoPlayerText !== this.props.dispInfoPlayerText) ||
            (nextProps.dispFormatMainTimeFSNumDigits !== this.props.dispFormatMainTimeFSNumDigits) ||
            (nextProps.dispFormatPeriodTimeFSNumDigits !== this.props.dispFormatPeriodTimeFSNumDigits) ||
            (nextProps.dispOnExpired !== this.props.dispOnExpired)

        if (timeChanged || modeChanged || dispChanged) {
            nstate = helper.deepCopyIfSame({nstate: nstate, pstate: this.state})
            nstate.fixedWidth = this.calcFixedClockWidth(nextProps)
        }

        let didInit = false
        if (initStaged) {
            let preInitStage = (this.state.activePlayers == null)
            if (preInitStage || timeChanged || madeMove) {
                let numPlayers = nextProps.initialTime != null ?
                    nextProps.initialTime.length : null
                nstate = helper.deepCopyIfSame({nstate: nstate, pstate: this.state})
                nstate.initialTime = nextProps.initialTime
                this.initActivePlayers({
                    initialTime: nstate.initialTime,
                    numMoves: nextProps.numMoves,
                    nstate: nstate
                })
                this.setState({
                    activePlayers: nstate.activePlayers,
                    fixedWidth: nstate.fixedWidth,
                    initialTime: nstate.initialTime,
                    numMovesPerPlayer: nstate.numMovesPerPlayer,
                    prevPlayer: nstate.prevPlayer
                })
                return
            }
        }

        let prevPlayer
        let activePlayers = this.getActivePlayers({nstate: nstate})
        let curPlayer = (activePlayers != null) ? activePlayers[0] : null
        let numMovesPerPlayer = this.getNumMovesPerPlayer({nstate: nstate})
        if (madeMove) {
            let prevNumMoves = this.props.numMoves != null ?
                this.props.numMoves : 0

            if (nextProps.numMoves > prevNumMoves) {
                if (activePlayers != null) {
                    curPlayer = activePlayers[0]
                    let i
                    for (i = prevNumMoves; i < nextProps.numMoves; i++) {
                        // update curPlayer, prevPlayer
                        numMovesPerPlayer[curPlayer]++
                        prevPlayer = curPlayer
                        curPlayer = activePlayers.shift()
                        activePlayers.push(curPlayer)
                    }
                    curPlayer = activePlayers[0]
                    nstate = helper.deepCopyIfSame({nstate: nstate, pstate: this.state})
                    nstate.activePlayers = activePlayers,
                    nstate.numMovesPerPlayer = numMovesPerPlayer,
                    nstate.prevPlayer = prevPlayer
                }
            }
        }

        if (nextProps.mode === 'reset' &&
                (modeChanged || clockModeChanged || madeMove || timeChanged)
            ) {
            // Reset time to initial time
            // Allow for changing playerID, after initial reset
            // To change playerID after reset: mode = reset, numMoves++
            nstate = helper.deepCopyIfSame({nstate: nstate, pstate: this.state})
            if (modeChanged) {
                // Reset players only once: further resets won't reset player
                prevPlayer = curPlayer
                activePlayers = nextProps.initialTime != null ?
                    this.getInitActivePlayers({
                        initialTime: nextProps.initialTime,
                        numMoves: nextProps.numMoves,
                        nstate: nstate
                    }) : null
                curPlayer = activePlayers != null ? activePlayers[0] : null
            } else {
                if (prevPlayer == null) {
                    if (curPlayer != null) {
                        prevPlayer = curPlayer
                    }
                }
            }
            nstate.activePlayers = activePlayers
            nstate.doReset = modeChanged
            nstate.initialTime = nextProps.initialTime
            nstate.prevPlayer = prevPlayer
        }

        this.setState({
            activePlayers: nstate.activePlayers,
            doReset: nstate.doReset,
            fixedWidth: nstate.fixedWidth,
            initialTime: nstate.initialTime,
            numMovesPerPlayer: nstate.numMovesPerPlayer,
            prevPlayer: nstate.prevPlayer
        })
    }

    render() {
        let {
            activePlayers,
            doReset,
            fixedWidth,
            numMovesPerPlayer,
            prevPlayer
        } = this.state

        let {
            clockMode = ['absolutePerPlayer'],
            dispInfoNumPeriods = true,
            dispInfoPeriodMoves = true,
            dispInfoPlayerText = true,
            dispCountElapsedMainTime = false,
            dispCountElapsedNumPeriods = false,
            dispCountElapsedPeriodMoves = false,
            dispCountElapsedPeriodTime = false,
            dispFormatMainTimeFSNumDigits = 2,
            dispFormatMainTimeFSLastNumSecs = null,
            dispFormatMainTimeFSUpdateInterval = 0.02,
            dispFormatPeriodTimeFSNumDigits = 2,
            dispFormatPeriodTimeFSLastNumSecs = null,
            dispFormatPeriodTimeFSUpdateInterval = 0.02,
            dispOnExpired = 'OT',
            gameClockID = 1,
            initialTime = null,
            minActiveClocks = 2,
            mode = null
        } = this.props

        let haveActive = (activePlayers != null)
        let numActive = haveActive ? activePlayers.length : 0
        let haveMinActive = minActiveClocks != null &&
            (minActiveClocks >= 1) &&
            (numActive >= minActiveClocks)

        let hasInitTime
        if (initialTime != null && initialTime.length > 0) {
            hasInitTime = true
        } else {
            hasInitTime = false
        }

        return h('div',
            {
                className: classnames(
                    'gameclock',
                    'gameclock_' + gameClockID
                ),
                'data-numActive': numActive,
                'data-numClocks': (initialTime != null ?
                        initialTime.length : 0),
                id: 'gameclock_' + gameClockID
            },

            hasInitTime && initialTime.map((initTime, i) =>
                h(playerclock, {
                    clockActive: (mode === 'resume') &&
                        haveActive &&
                        haveMinActive &&
                        (activePlayers[0] === initTime.playerID),
                    clockMode: clockMode,
                    dispInfoNumPeriods: dispInfoNumPeriods,
                    dispInfoPeriodMoves: dispInfoPeriodMoves,
                    dispInfoPlayerText: dispInfoPlayerText,
                    dispCountElapsedMainTime: dispCountElapsedMainTime,
                    dispCountElapsedNumPeriods: dispCountElapsedNumPeriods,
                    dispCountElapsedPeriodMoves: dispCountElapsedPeriodMoves,
                    dispCountElapsedPeriodTime: dispCountElapsedPeriodTime,
                    dispFormatMainTimeFSNumDigits: dispFormatMainTimeFSNumDigits,
                    dispFormatMainTimeFSLastNumSecs: dispFormatMainTimeFSLastNumSecs,
                    dispFormatMainTimeFSUpdateInterval: dispFormatMainTimeFSUpdateInterval,
                    dispFormatPeriodTimeFSNumDigits: dispFormatPeriodTimeFSNumDigits,
                    dispFormatPeriodTimeFSLastNumSecs: dispFormatPeriodTimeFSLastNumSecs,
                    dispFormatPeriodTimeFSUpdateInterval: dispFormatPeriodTimeFSUpdateInterval,
                    dispOnExpired: dispOnExpired,
                    fixedWidth: fixedWidth,
                    gameClockID: gameClockID,
                    doReset: doReset,
                    initialTime: initTime,
                    handleInit: this.handleInit,
                    handleMadeMove: this.handleMadeMove,
                    handlePaused: this.handlePaused,
                    handlePlayerClockExpired: this.handlePlayerClockExpired,
                    handleReset: this.handleReset,
                    handleResumed: this.handleResumed,
                    handleUpdated: this.props.handleUpdated,
                    numMoves: ((numMovesPerPlayer != null) ?
                        [numMovesPerPlayer[initTime.playerID]] : 0),
                    playerID: initTime.playerID,
                    playerText: initTime.playerText
                })
            )
        )
    }
}

module.exports = gameclock

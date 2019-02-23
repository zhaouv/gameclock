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
            hourglassAdjTime: null,
            hourglassEventID: null,
            hourglassPlayerID: null,
            initialTime: null,
            numMovesPerPlayer: null,
            prevNumMoves: null,
            prevPlayer: null,
            waitMadeMove: false
        }

        this.calcFixedClockWidth = this.calcFixedClockWidth.bind(this)

        this.getActivePlayers = this.getActivePlayers.bind(this)
        this.getInitActivePlayers = this.getInitActivePlayers.bind(this)
        this.getNumMovesPerPlayer = this.getNumMovesPerPlayer.bind(this)

        this.initActivePlayers = this.initActivePlayers.bind(this)
        this.initNumMovesPerPlayer = this.initNumMovesPerPlayer.bind(this)

        this.handleAdjust = this.handleAdjust.bind(this)
        this.handleElapsedMainTime = this.handleElapsedMainTime.bind(this)
        this.handleElapsedPeriod = this.handleElapsedPeriod.bind(this)
        this.handleInit = this.handleInit.bind(this)
        this.handleMadeMove = this.handleMadeMove.bind(this)
        this.handlePaused = this.handlePaused.bind(this)
        this.handlePlayerClockExpired = this.handlePlayerClockExpired.bind(this)
        this.handleReset = this.handleReset.bind(this)
        this.handleResumed = this.handleResumed.bind(this)
        this.handleTenCount = this.handleTenCount.bind(this)

        this.shiftPlayerAfterMadeMove = this.shiftPlayerAfterMadeMove.bind(this)
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
        this.initNumMovesPerPlayer({
            initialTime: initialTime,
            nstate: nstate
        })
        // Enumerate activePlayers from 1 to number of players
        let numPlayers = ((initialTime != null) && (initialTime.length > 0)) ?
            initialTime.length : 0
        let activePlayers = null
        if (numPlayers > 0) {
            activePlayers = initialTime.map((k, v) => k.playerID)
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
            nstate.activePlayers = activePlayers
            nstate.prevNumMoves = numMoves
            nstate.prevPlayer = null
        } else {
            nstate.activePlayers = null
            this.initNumMovesPerPlayer({nstate: nstate})
            nstate.prevNumMoves = numMoves
        }
        nstate.waitMadeMove = false
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

    handleAdjust({playerID = null, clock = null, eventID = null,
        byHourglass = false, resetExpired = false} = {}) {
        if (resetExpired) {
            // gave back time to a clock that was expired, and is now no longer expired
            // insert clock back into activePlayers in order of initialTime
            // always insert after (preserve current active player)
            this.setState((state, props) => {
                let activePlayers = JSON.parse(JSON.stringify(state.activePlayers))
                let ret
                if (state.activePlayers.indexOf(playerID) === -1) {
                    let initTime = props.initialTime

                    let indexOfExpiredPlayer = initTime.reduce((v, item, index, a) => {
                        return (item.playerID === playerID ? index : v)}, -1)

                    let playerBeforeIndex = indexOfExpiredPlayer - 1
                    let playerToSearch
                    while (playerBeforeIndex >= 0) {
                        playerToSearch = initTime[playerBeforeIndex].playerID
                        let playerActive = activePlayers.some((player) => {
                            return (player === playerToSearch)})
                        if (playerActive) {
                            break
                        }
                        playerBeforeIndex--
                    }

                    let insertIndex
                    if (playerBeforeIndex < 0) {
                        insertIndex = initTime.length
                    } else {
                        insertIndex = activePlayers.reduce((v, item, index, a) => {
                            return (item === playerToSearch ? index : v)}, initTime.length)
                        insertIndex++
                    }
                    activePlayers.splice(insertIndex, 0, playerID)
                    ret = {activePlayers: activePlayers}
                } else {
                    ret = {}
                }
                if (props.handleAdjust != null && byHourglass === false) {
                    props.handleAdjust({
                        clock: clock,
                        playerID: playerID,
                        adjustEventID: eventID,
                        activePlayers: activePlayers
                    })
                }
                return ret
            })
        } else {
            if (this.props.handleAdjust != null && byHourglass === false) {
                let activePlayers = this.getActivePlayers({nstate: this.state})
                this.props.handleAdjust({
                    clock: clock,
                    playerID: playerID,
                    adjustEventID: eventID,
                    activePlayers: activePlayers
                })
            }
        }
    }

    handleElapsedMainTime({playerID = null, clock = null} = {}) {
        let activePlayers = this.getActivePlayers({nstate: this.state})
        if (this.props.handleElapsedMainTime != null) {
            this.props.handleElapsedMainTime({
                clock: clock,
                playerID: playerID,
                activePlayers: activePlayers
            })
        }
    }

    handleElapsedPeriod({playerID = null, clock = null} = {}) {
        let activePlayers = this.getActivePlayers({nstate: this.state})
        if (this.props.handleElapsedPeriod != null) {
            this.props.handleElapsedPeriod({
                clock: clock,
                playerID: playerID,
                activePlayers: activePlayers
            })
        }
    }

    handleInit({playerID = null, clock = null} = {}) {
        let activePlayers = this.getActivePlayers({nstate: this.state})
        if (this.props.handleInit != null) {
            this.props.handleInit({
                clock: clock,
                playerID: playerID,
                activePlayers: activePlayers
            })
        }
    }

    handleMadeMove({playerID = null, clock = null} = {}) {
        let activePlayers = this.getActivePlayers({nstate: this.state})
        this.setState((state, props) => {
            let nstate = {waitMadeMove: false}
            if (state != null && props.clockMode === 'hourglass') {
                let moveTime = clock.elapsedMoveTime
                if (moveTime != null && moveTime > 0 && state.activePlayers != null) {
                    let hourglassPlayerID = JSON.parse(JSON.stringify(state.activePlayers[0]))
                    if (hourglassPlayerID != null) {
                        nstate.hourglassAdjTime = -moveTime
                        nstate.hourglassPlayerID = hourglassPlayerID
                        nstate.hourglassEventID = (state.hourglassEventID == null ?
                            0 : (state.hourglassEventID + 1))
                    }
                }
            }
            return nstate})
        if (this.props.handleMadeMove != null) {
            this.props.handleMadeMove({
                clock: clock,
                playerID: playerID,
                activePlayers: activePlayers
            })
        }
    }

    handlePaused({playerID = null, clock = null} = {}) {
        let activePlayers = this.getActivePlayers({nstate: this.state})
        if (this.props.handlePaused != null) {
            this.props.handlePaused({
                clock: clock,
                playerID: playerID,
                activePlayers: activePlayers
            })
        }
    }

    handlePlayerClockExpired({playerID = null, clock = null} = {}) {
        // remove player from activePlayers
        if (this.state.activePlayers == null) {
            return
        }
        if (this.state.activePlayers.indexOf(playerID) === -1) {
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

        this.setState((state, props) => {
            let nstate = {
                prevPlayer: prevPlayer,
                activePlayers: activePlayers
            }
            if (state != null && props.clockMode === 'hourglass') {
                let moveTime = clock.elapsedMoveTime
                if (moveTime != null && moveTime > 0 && activePlayers != null) {
                    let hourglassPlayerID = JSON.parse(JSON.stringify(activePlayers[0]))
                    if (hourglassPlayerID != null) {
                        nstate.hourglassAdjTime = -moveTime
                        nstate.hourglassPlayerID = hourglassPlayerID
                        nstate.hourglassEventID = (state.hourglassEventID == null ?
                            0 : (state.hourglassEventID + 1))
                    }
                }
            }
            return nstate})

        if (this.props.handlePlayerClockExpired != null) {
            this.props.handlePlayerClockExpired({
                clock: clock,
                playerID: JSON.parse(JSON.stringify(prevPlayer)),
                nextPlayer: JSON.parse(JSON.stringify(activePlayers[0])),
                activePlayers: JSON.parse(JSON.stringify(activePlayers))
            })
        }
    }

    handleReset({playerID = null, clock = null} = {}) {
        let activePlayers = this.getActivePlayers({nstate: this.state})
        this.setState({
            doReset: false
        })
        if (this.props.handleReset != null) {
            this.props.handleReset({
                clock: clock,
                playerID: playerID,
                activePlayers: activePlayers
            })
        }
    }

    handleResumed({playerID = null, clock = null} = {}) {
        let activePlayers = this.getActivePlayers({nstate: this.state})
        if (this.props.handleResumed != null) {
            this.props.handleResumed({
                clock: clock,
                playerID: playerID,
                activePlayers: activePlayers
            })
        }
    }

    handleTenCount({playerID = null, clock = null} = {}) {
        let activePlayers = this.getActivePlayers({nstate: this.state})
        if (this.props.handleTenCount != null) {
            this.props.handleTenCount({
                clock: clock,
                playerID: playerID,
                activePlayers: activePlayers
            })
        }
    }

    shiftPlayerAfterMadeMove({nstate = this.state, nprops = this.props} = {}) {
        if (
            nstate.prevNumMoves != null &&
            nprops.numMoves != null &&
            nstate.numMovesPerPlayer != null &&
            nstate.activePlayers != null &&
            nstate.prevNumMoves >= 0 &&
            nprops.numMoves >= 0 &&
            nstate.prevNumMoves < nprops.numMoves
            ) {

            let prevPlayer
            let activePlayers = this.getActivePlayers({nstate: nstate})
            let curPlayer = activePlayers[0]
            let numMovesPerPlayer = this.getNumMovesPerPlayer({nstate: nstate})

            numMovesPerPlayer[curPlayer]++
            prevPlayer = curPlayer
            curPlayer = activePlayers.shift()
            activePlayers.push(curPlayer)

            nstate.activePlayers = activePlayers,
            nstate.numMovesPerPlayer = numMovesPerPlayer,
            nstate.prevPlayer = prevPlayer
            nstate.prevNumMoves++
            nstate.waitMadeMove = true
        }
    }

    componentDidMount() {
        let nstate = helper.deepCopyIfSame({a: this.state, b: this.state})
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
            prevNumMoves: nstate.prevNumMoves,
            prevPlayer: nstate.prevPlayer,
            waitMadeMove: nstate.waitMadeMove
        })
        this.props.handleUpdated()
    }

    componentDidUpdate(prevProps, prevState) {
        this.props.handleUpdated()
        let nstate = this.state
        let nprops = this.props
        if (nstate.prevNumMoves < nstate.numMoves && !nstate.waitMadeMove) {
            // in case multiple moves made faster than update
            nstate = helper.deepCopyIfSame({a: nstate, b: this.state})
            this.shiftPlayerAfterMadeMove({nstate: nstate, nprops: nprops})
            this.setState({
                activePlayers: nstate.activePlayers,
                numMovesPerPlayer: nstate.numMovesPerPlayer,
                prevPlayer: nstate.prevPlayer,
                prevNumMoves: nstate.prevNumMoves,
                waitMadeMove: nstate.waitMadeMove
            })
        }
    }

    componentWillReceiveProps(nextProps) {
        let nstate = this.state

        let initStaged = (nextProps.mode === 'init' ||
            (this.props.mode === 'init' && nextProps.mode !== 'reset'))
        let timeChanged = !helper.shallowEquals(
            nextProps.initialTime, this.props.initialTime)
        let madeMove = (nextProps.numMoves !== this.props.numMoves)
        let numMovesReset = (madeMove && (nextProps.numMoves == 0))
        let modeChanged = (this.props.mode !== nextProps.mode)
        let clockModeChanged = (this.props.clockMode !== nextProps.clockMode)

        let dispChanged = (nextProps.dispInfoNumPeriods !== this.props.dispInfoNumPeriods) ||
            (nextProps.dispInfoPeriodMoves !== this.props.dispInfoPeriodMoves) ||
            (nextProps.dispInfoPlayerText !== this.props.dispInfoPlayerText) ||
            (nextProps.dispFormatMainTimeFSNumDigits !== this.props.dispFormatMainTimeFSNumDigits) ||
            (nextProps.dispFormatPeriodTimeFSNumDigits !== this.props.dispFormatPeriodTimeFSNumDigits) ||
            (nextProps.dispOnExpired !== this.props.dispOnExpired)

        if (timeChanged || clockModeChanged || modeChanged || dispChanged) {
            nstate = helper.deepCopyIfSame({a: nstate, b: this.state})
            nstate.fixedWidth = this.calcFixedClockWidth(nextProps)
        }

        let didInit = false
        if (initStaged) {
            let preInitStage = (this.state.activePlayers == null)
            if (preInitStage || timeChanged || madeMove) {
                let numPlayers = nextProps.initialTime != null ?
                    nextProps.initialTime.length : null
                nstate = helper.deepCopyIfSame({a: nstate, b: this.state})
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
                    prevNumMoves: nstate.prevNumMoves,
                    prevPlayer: nstate.prevPlayer,
                    waitMadeMove: nstate.waitMadeMove
                })
                return
            }
        }

        if (madeMove && !numMovesReset && !nstate.waitMadeMove) {
            nstate = helper.deepCopyIfSame({a: nstate, b: this.state})
            this.shiftPlayerAfterMadeMove({nstate: nstate, nprops: nextProps})
        }

        let prevPlayer
        let activePlayers = this.getActivePlayers({nstate: nstate})
        let curPlayer = (activePlayers != null) ? activePlayers[0] : null
        let numMovesPerPlayer = this.getNumMovesPerPlayer({nstate: nstate})

        if (nextProps.mode === 'reset' &&
                (modeChanged || clockModeChanged || madeMove || timeChanged)
            ) {
            // Reset time to initial time
            // Allow for changing playerID, after initial reset
            // To change playerID after reset: mode = reset, numMoves++
            nstate = helper.deepCopyIfSame({a: nstate, b: this.state})
            nstate.initialTime = nextProps.initialTime
            if (numMovesReset) {
                nstate.prevNumMoves = nextProps.numMoves
                nstate.waitMadeMove = false
            }
            if (clockModeChanged || modeChanged || numMovesReset || timeChanged) {
                // Reset players only once: further resets won't reset player
                prevPlayer = curPlayer
                activePlayers = nextProps.initialTime != null ?
                    this.getInitActivePlayers({
                        initialTime: nextProps.initialTime,
                        nstate: nstate
                    }) : null
                nstate.activePlayers = activePlayers
                curPlayer = activePlayers != null ? activePlayers[0] : null
                numMovesPerPlayer = this.getNumMovesPerPlayer({nstate: nstate})
            } else {
                nstate.activePlayers = activePlayers
                if (prevPlayer == null) {
                    if (curPlayer != null) {
                        prevPlayer = curPlayer
                    }
                }
            }
            nstate.doReset = clockModeChanged || modeChanged || timeChanged || numMovesReset
            nstate.prevPlayer = prevPlayer
        }

        this.setState({
            activePlayers: nstate.activePlayers,
            doReset: nstate.doReset,
            fixedWidth: nstate.fixedWidth,
            initialTime: nstate.initialTime,
            numMovesPerPlayer: nstate.numMovesPerPlayer,
            prevNumMoves: nstate.prevNumMoves,
            prevPlayer: nstate.prevPlayer,
            waitMadeMove: nstate.waitMadeMove
        })
    }

    render() {
        let {
            activePlayers,
            doReset,
            fixedWidth,
            hourglassAdjTime,
            hourglassEventID,
            hourglassPlayerID,
            numMovesPerPlayer,
            prevNumMoves,
            prevPlayer,
            waitMadeMove
        } = this.state

        let {
            adjustAction = null,
            adjustEventID = null,
            adjustPlayerID = null,
            adjustVal = null,
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
                    adjustAction: adjustAction,
                    adjustEventID: adjustEventID,
                    adjustPlayerID: adjustPlayerID,
                    adjustVal: adjustVal,
                    clockActive: (mode === 'resume') &&
                        haveActive &&
                        haveMinActive &&
                        !waitMadeMove &&
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
                    doReset: doReset,
                    fixedWidth: fixedWidth,
                    gameClockID: gameClockID,
                    initialTime: initTime,
                    handleAdjust: this.handleAdjust,
                    handleElapsedMainTime: this.handleElapsedMainTime,
                    handleElapsedPeriod: this.handleElapsedPeriod,
                    handleInit: this.handleInit,
                    handleMadeMove: this.handleMadeMove,
                    handlePaused: this.handlePaused,
                    handlePlayerClockExpired: this.handlePlayerClockExpired,
                    handleReset: this.handleReset,
                    handleResumed: this.handleResumed,
                    handleTenCount: this.handleTenCount,
                    handleUpdated: this.props.handleUpdated,
                    hourglassAdjTime: hourglassAdjTime,
                    hourglassEventID: hourglassEventID,
                    hourglassPlayerID: hourglassPlayerID,
                    numMoves: ((numMovesPerPlayer != null) ?
                        numMovesPerPlayer[initTime.playerID] : 0),
                    playerID: initTime.playerID,
                    playerText: initTime.playerText
                })
            )
        )
    }
}

module.exports = gameclock

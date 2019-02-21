const {createElement: h, Component} = require('preact')
const classnames = require('classnames')

const helper = require('./helper.js')

class playerclock extends Component {
    constructor(props) {
        super(props)

        // hybridClock keeps track of the elaspsed time and clock state
        this.state = {
            hybridClock: null
        }

        // internalClock keep absolute time reference points for hybridInternalClock
        this.internalClock = {
            state: 'preinit',
            timeOnIntervalEnd: null,
            timeOnIntervalStart: null,
            timeOnPause: null,
            timeOnReset: null,
            timeOnResume: null,
            timeOnStart: null
        }

        this.adjIC = this.adjIC.bind(this)
        this.getRangeIC = this.getRangeIC.bind(this)

        this.addElapsedHybridIC = this.addElapsedHybridIC.bind(this)
        this.adjHybridIC = this.adjHybridIC.bind(this)

        // scriptable Clock Events
        this.onElapsedPeriodAndRepeatsLeft = this.onElapsedPeriodAndRepeatsLeft.bind(this)
        this.onElapsedPeriodAndNoRepeatsLeft = this.onElapsedPeriodAndNoRepeatsLeft.bind(this)
        this.onMoveAndPeriodMovesElapsed = this.onMoveAndPeriodMovesElapsed.bind(this)
        this.onMoveAndPeriodMovesNotElapsed = this.onMoveAndPeriodMovesNotElapsed.bind(this)

        // glue between hybridClock (internal state) and tick methods
        this.expireTimer = this.expireTimer.bind(this)
        this.initTimer = this.initTimer.bind(this)
        this.madeAdjustTimer = this.madeAdjustTimer.bind(this)
        this.madeMoveTimer = this.madeMoveTimer.bind(this)
        this.pauseTimer = this.pauseTimer.bind(this)
        this.resetTimer = this.resetTimer.bind(this)
        this.resumeTimer = this.resumeTimer.bind(this)
        this.updateTimer = this.updateTimer.bind(this)

        // update the clock every second and render on time
        this.calcTimeUntilNextWholeSecond = this.calcTimeUntilNextWholeSecond.bind(this)
        this.startTick = this.startTick.bind(this)
        this.stopTick = this.stopTick.bind(this)
        this.tick = this.tick.bind(this)

        // callback handling
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

        this.timeoutID = null
        this.intervalID = null
        this.cancelDispUpdate = false
    }

    adjIC({action = null} = {}) {
        let clk = this.internalClock
        let ret = false
        if (action === 'update') {
            if (clk.state === 'running') {
                clk.timeOnIntervalStart = clk.timeOnIntervalEnd
                clk.timeOnIntervalEnd = helper.timeNow()
                ret = true
            }
        } else if (action === 'pause') {
            if (clk.state === 'running') {
                clk.timeOnPause = helper.timeNow()
                clk.timeOnIntervalEnd = clk.timeOnPause
                clk.state = 'paused'
                ret = true
            }
        } else if (action === 'resume') {
            if (clk.state === 'paused') {
                clk.timeOnResume = helper.timeNow()
                clk.timeOnIntervalStart = clk.timeOnResume
                clk.timeOnIntervalEnd = clk.timeOnResume
                clk.state = 'running'
                ret = true
            } else if (clk.state === 'init') {
                clk.timeOnStart = helper.timeNow()
                clk.timeOnIntervalStart = clk.timeOnStart
                clk.timeOnIntervalEnd = clk.timeOnStart
                clk.state = 'running'
                ret = true
            }
        } else if (action === 'reset') {
            if (clk.state !== 'preinit') {
                clk.timeOnReset = helper.timeNow()
                clk.timeOnPause = null
                clk.timeOnResume = null
                clk.timeOnIntervalStart = null
                clk.timeOnIntervalEnd = null
                clk.timeOnStart = null
                clk.state = 'init'
                ret = true
            }
        } else if (action === 'init') {
            clk.timeOnReset = null
            clk.timeOnPause = null
            clk.timeOnResume = null
            clk.timeOnIntervalStart = null
            clk.timeOnIntervalEnd = null
            clk.timeOnStart = null
            clk.state = 'init'
            ret = true
        }
        return ret
    }

    getRangeIC({reftime = null} = {}) {
        let clk = this.internalClock
        let ret = null
        if (reftime === 'start') {
            if (clk.state === 'running' || clk.state === 'paused') {
                ret = (helper.timeNow() - clk.timeOnStart)
            }
        } else if (reftime === 'pause') {
            if (clk.state === 'paused') {
                ret = (helper.timeNow() - clk.timeOnPause)
            }
        } else if (reftime === 'resume') {
            if (clk.state === 'running' && clk.timeOnResume != null) {
                ret = (helper.timeNow() - clk.timeOnResume)
            }
        } else if (reftime === 'interval') {
            if (clk.state === 'paused' || clk.state === 'running') {
                ret = (clk.timeOnIntervalEnd - clk.timeOnIntervalStart)
            }
        }
        return ret
    }

    addElapsedHybridIC({elapsed = null, madeMove = false, nstate = null, nprops = null} = {}) {
        // add time, update time, and...
        // check if time expired on: pausing, updating, or adding moves
        if (elapsed == null) {
            return
        }

        let hclk = nstate.hybridClock
        let initTime = nprops.initialTime
        let clockMode = nprops.clockMode

        let expired = false

        // add exact time used to elapsedTotalTime ...
        // can use it to calculate how much time player took to move
        // elapsedTotalTime is actual time taken, not zero when period not used in byo-yomi

        let initMainTime = initTime.mainTime
        let initPeriodTime = initTime.periodTime

        if (clockMode === 'absolutePerPlayer') {
            if (hclk.elapsedMainTime >= initMainTime) {
                // already expired
                expired = true
                this.adjHybridIC({
                    action: 'setExpired',
                    nstate: nstate,
                    nprops: nprops
                })
                this.handleElapsedMainTime({nstate: nstate, nprops: nprops})
            } else if ((hclk.elapsedMainTime + elapsed) >= initMainTime) {
                // will use up main time
                expired = true

                // calculate time used to reach expire (since we can't exceed clock time)
                let elapsedRemainder = initMainTime - hclk.elapsedMainTime
                this.adjHybridIC({
                    action: 'incrElapsedTotalTime',
                    arg: elapsedRemainder,
                    nstate: nstate,
                    nprops: nprops
                })
                this.adjHybridIC({
                    action: 'incrElapsedMainTime',
                    arg: elapsedRemainder,
                    nstate: nstate,
                    nprops: nprops
                })
                this.adjHybridIC({
                    action: 'setExpired',
                    nstate: nstate,
                    nprops: nprops
                })
                this.handleElapsedMainTime({nstate: nstate, nprops: nprops})
            } else {
                // will not use up main time
                this.adjHybridIC({
                    action: 'incrElapsedTotalTime',
                    arg: elapsed,
                    nstate: nstate,
                    nprops: nprops
                })
                this.adjHybridIC({
                    action: 'incrElapsedMainTime',
                    arg: elapsed,
                    nstate: nstate,
                    nprops: nprops
                })
            }
        } else if (clockMode === 'byo-yomi') {
            let elapsedRemainder
            let mainTimeLeft
            if (hclk.elapsedMainTime >= initMainTime) {
                // already used up main time
                elapsedRemainder = elapsed
                mainTimeLeft = false
            } else if ((hclk.elapsedMainTime + elapsed) >= initMainTime) {
                // will use up main time
                this.adjHybridIC({
                    action: 'incrElapsedTotalTime',
                    arg: (initMainTime - hclk.elapsedMainTime),
                    nstate: nstate,
                    nprops: nprops
                })
                elapsedRemainder = hclk.elapsedMainTime + elapsed - initMainTime
                mainTimeLeft = false
                this.adjHybridIC({
                    action: 'incrElapsedMainTime',
                    arg: (initMainTime - hclk.elapsedMainTime),
                    nstate: nstate,
                    nprops: nprops
                })
                this.handleElapsedMainTime({nstate: nstate, nprops: nprops})
            } else {
                // will not use up main time
                this.adjHybridIC({
                    action: 'incrElapsedTotalTime',
                    arg: elapsed,
                    nstate: nstate,
                    nprops: nprops
                })
                elapsedRemainder = 0
                mainTimeLeft = true
                this.adjHybridIC({
                    action: 'incrElapsedMainTime',
                    arg: elapsed,
                    nstate: nstate,
                    nprops: nprops
                })
            }
            if (!mainTimeLeft) {
                let periodsRemain = initTime.numPeriods - hclk.elapsedNumPeriods
                let elapsedPeriod = (hclk.elapsedPeriodTime + elapsedRemainder >= initPeriodTime)
                if (periodsRemain > 1 && elapsedPeriod) {
                    // when we have more than one repeated period left,
                    // and at least 1 period has expired,
                    // count one period up
                    this.adjHybridIC({
                        action: 'setTenCount',
                        arg: false,
                        nstate: nstate,
                        nprops: nprops
                    })
                    elapsedRemainder = this.onElapsedPeriodAndRepeatsLeft({
                        elapsed: elapsedRemainder,
                        nstate: nstate,
                        nprops: nprops
                    })
                    expired = this.addElapsedHybridIC({
                        elapsed: elapsedRemainder,
                        madeMove: madeMove,
                        nstate: nstate,
                        nprops: nprops
                    })
                } else {
                    // when we have no repeated periods left (final repeat repriod)
                    // account for elapsed time
                    if (madeMove) {
                        this.adjHybridIC({
                            action: 'setTenCount',
                            arg: false,
                            nstate: nstate,
                            nprops: nprops
                        })
                        this.adjHybridIC({
                            action: 'incrElapsedPeriodMoves',
                            nstate: nstate,
                            nprops: nprops
                        })
                    }
                    if (hclk.elapsedPeriodTime === initPeriodTime) {
                        // time expired already
                        expired = true
                        this.adjHybridIC({
                            action: 'setTenCount',
                            arg: false,
                            nstate: nstate,
                            nprops: nprops
                        })
                        this.adjHybridIC({
                            action: 'setExpired',
                            nstate: nstate,
                            nprops: nprops
                        })
                    } else if (hclk.elapsedPeriodTime + elapsedRemainder >= initPeriodTime) {
                        this.adjHybridIC({
                            action: 'setTenCount',
                            arg: false,
                            nstate: nstate,
                            nprops: nprops
                        })
                        this.onElapsedPeriodAndNoRepeatsLeft({
                            elapsed: elapsedRemainder,
                            nstate: nstate,
                            nprops: nprops
                        })
                        expired = true
                        this.adjHybridIC({
                            action: 'setExpired',
                            nstate: nstate,
                            nprops: nprops
                        })
                    } else {
                        // its possible to have multiple very fast moves,
                        // faster than a chance to update the hclk, so use >=
                        if (madeMove) {
                            this.adjHybridIC({
                                action: 'setTenCount',
                                arg: false,
                                nstate: nstate,
                                nprops: nprops
                            })
                            if (hclk.elapsedPeriodMoves >= initTime.periodMoves) {
                                this.onMoveAndPeriodMovesElapsed({
                                    elapsed: elapsedRemainder,
                                    nstate: nstate,
                                    nprops: nprops
                                })
                            } else {
                                this.onMoveAndPeriodMovesNotElapsed({
                                    elapsed: elapsedRemainder,
                                    nstate: nstate,
                                    nprops: nprops
                                })
                            }
                        } else {
                            // special case:
                            // don't add time when we just reset the period,
                            // and waiting for clock to stop/resume
                            if (!(hclk.resetPeriod === true)) {
                                this.adjHybridIC({
                                    action: 'incrElapsedTotalTime',
                                    arg: elapsedRemainder,
                                    nstate: nstate,
                                    nprops: nprops
                                })
                                this.adjHybridIC({
                                    action: 'incrElapsedPeriodTime',
                                    arg: elapsedRemainder,
                                    nstate: nstate,
                                    nprops: nprops
                                })
                            }
                            if ( !hclk.didTenCount &&
                                (initPeriodTime - hclk.elapsedPeriodTime) <= 10) {

                                this.adjHybridIC({
                                    action: 'setTenCount',
                                    arg: true,
                                    nstate: nstate,
                                    nprops: nprops
                                })
                                this.handleTenCount({
                                    nstate: nstate, nprops: nprops})
                            }
                        }
                    }
                }
            }
        }

        return expired
    }

    onElapsedPeriodAndNoRepeatsLeft({elapsed = null, nstate = null, nprops = null}) {
        let hclk = nstate.hybridClock
        let initPeriodTime = nprops.initialTime.periodTime

        this.adjHybridIC({
            action: 'incrElapsedTotalTime',
            arg: (initPeriodTime - hclk.elapsedPeriodTime),
            nstate: nstate,
            nprops: nprops
        })
        this.adjHybridIC({
            action: 'setElapsedPeriodTime',
            arg: initPeriodTime,
            nstate: nstate,
            nprops: nprops
        })
        this.adjHybridIC({
            action: 'incrElapsedNumPeriods',
            nstate: nstate,
            nprops: nprops
        })
        this.adjHybridIC({
            action: 'setExpired',
            nstate: nstate,
            nprops: nprops
        })
        this.handleElapsedPeriod({nstate: nstate, nprops: nprops})
    }

    onElapsedPeriodAndRepeatsLeft({elapsed = null, nstate = null, nprops = null}) {
        let hclk = nstate.hybridClock
        let initPeriodTime = nprops.initialTime.periodTime

        elapsed -= (initPeriodTime - hclk.elapsedPeriodTime)

        this.adjHybridIC({
            action: 'incrElapsedTotalTime',
            arg: (initPeriodTime - hclk.elapsedPeriodTime),
            nstate: nstate,
            nprops: nprops
        })
        this.adjHybridIC({
            action: 'setElapsedPeriodTime',
            arg: 0,
            nstate: nstate,
            nprops: nprops
        })
        this.adjHybridIC({
            action: 'setElapsedPeriodMoves',
            arg: 0,
            nstate: nstate,
            nprops: nprops
        })
        this.adjHybridIC({
            action: 'incrElapsedNumPeriods',
            nstate: nstate,
            nprops: nprops
        })
        this.handleElapsedPeriod({nstate: nstate, nprops: nprops})
        return elapsed
    }

    onMoveAndPeriodMovesElapsed({elapsed = null, nstate = null, nprops = null}) {
        let hclk = nstate.hybridClock
        // special case:
        // don't add time when we just reset the period,
        // and waiting for clock to stop/resume
        if (!(hclk.resetPeriod === true)) {
            this.adjHybridIC({
                action: 'incrElapsedTotalTime',
                arg: elapsed,
                nstate: nstate,
                nprops: nprops
            })
        }
        // reset period clock information
        this.adjHybridIC({
            action: 'setElapsedPeriodTime',
            arg: 0,
            nstate: nstate,
            nprops: nprops
        })
        this.adjHybridIC({
            action: 'setElapsedPeriodMoves',
            arg: 0,
            nstate: nstate,
            nprops: nprops
        })
        this.adjHybridIC({
            action: 'resetPeriod',
            nstate: nstate,
            nprops: nprops
        })
    }

    onMoveAndPeriodMovesNotElapsed({elapsed = null, nstate = null, nprops = null} = {}) {
        let hclk = nstate.hybridClock
        // special case:
        // don't add time when we just reset the period,
        // and waiting for clock to stop/resume
        if (!(hclk.resetPeriod === true)) {
            this.adjHybridIC({
                action: 'incrElapsedTotalTime',
                arg: elapsed,
                nstate: nstate,
                nprops: nprops
            })
            this.adjHybridIC({
                action: 'incrElapsedPeriodTime',
                arg: elapsed,
                nstate: nstate,
                nprops: nprops
            })
        }
    }

    adjHybridIC({action = null, arg = null, nstate = null, nprops = null} = {}) {
        if (nstate == null) {
            return false
        }
        if (nstate.hybridClock == null) {
            nstate.hybridClock = {}
        }
        let hclk = nstate.hybridClock
        let ret = false
        if (action === 'update') {
            // update time & check if expired
            if (hclk.state === 'running') {
                if (this.adjIC({action: 'update'})) {
                    let interval = this.getRangeIC({reftime: 'interval'})
                    if (interval != null) {
                        let expired = this.addElapsedHybridIC({
                            elapsed: interval,
                            nstate: nstate,
                            nprops: nprops
                        })
                        if (expired) {
                            this.expireTimer({
                                nstate: nstate,
                                nprops: nprops
                            })
                        }
                        ret = true
                    }
                }
            }
        } else if (action === 'madeMove') {
            if (hclk.state === 'running') {
                // must use updateTimer prior to madeMove
                let expired = this.addElapsedHybridIC({
                    elapsed: 0,
                    madeMove: true,
                    nstate: nstate,
                    nprops: nprops
                })
                if (expired) {
                    this.expireTimer({
                        nstate: nstate,
                        nprops: nprops
                    })
                }
                // client must check state whether move was valid or not
                ret = true
            }
        } else if (action === 'pause') {
            if (hclk.state === 'running') {
                if (this.adjIC({action: 'pause'})) {
                    let interval = this.getRangeIC({reftime: 'interval'})
                    if (interval != null) {
                        let expired = this.addElapsedHybridIC({
                            elapsed: interval,
                            nstate: nstate,
                            nprops: nprops
                        })
                        hclk.resetPeriod = false
                        if (expired) {
                            this.expireTimer({
                                nstate: nstate,
                                nprops: nprops
                            })
                        } else {
                            hclk.state = 'paused'
                        }
                        ret = true
                    }
                }
            }
        } else if (action === 'resume') {
            if (hclk.state === 'paused' || hclk.state === 'init') {
                if (this.adjIC({action: 'resume'})) {
                    hclk.state = 'running'
                    ret = true
                }
            }
        } else if (action === 'reset') {
            if (hclk.state !== 'preinit') {
                this.adjIC({action: 'reset'})
                hclk.elapsedTotalTime = 0
                hclk.elapsedMoveTime = 0
                hclk.elapsedMainTime = 0
                hclk.elapsedNumPeriods = 0
                hclk.elapsedPeriodTime = 0
                hclk.elapsedPeriodMoves = 0
                hclk.resetPeriod = false
                hclk.state = 'init'
                hclk.didTenCount = false
                ret = true
            }
        } else if (action === 'init') {
            if (this.adjIC({action: 'init'})) {
                hclk.elapsedTotalTime = 0
                hclk.elapsedMoveTime = 0
                hclk.elapsedMainTime = 0
                hclk.elapsedNumPeriods = 0
                hclk.elapsedPeriodTime = 0
                hclk.elapsedPeriodMoves = 0
                hclk.resetPeriod = false
                hclk.state = 'init'
                hclk.didTenCount = false
                ret = true
            }
        } else if (action === 'incrElapsedMainTime') {
            if (arg != null) {
                hclk.elapsedMainTime += arg
                ret = true
            }
        } else if (action === 'incrElapsedNumPeriods') {
            if (arg == null) {
                hclk.elapsedNumPeriods++
            } else {
                hclk.elapsedNumPeriods += arg
            }
            ret = true
        } else if (action === 'incrElapsedPeriodMoves') {
            if (arg == null) {
                hclk.elapsedPeriodMoves++
            } else {
                hclk.elapsedPeriodMoves += arg
            }
            ret = true
        } else if (action === 'incrElapsedPeriodTime') {
            if (arg != null) {
                hclk.elapsedPeriodTime += arg
                if (hclk.elapsedPeriodTime < 0) {
                    hclk.elapsedMainTime += hclk.elapsedPeriodTime
                    hclk.elapsedPeriodTime = 0
                }
                ret = true
            }
        } else if (action === 'incrElapsedTotalTime') {
            if (arg != null) {
                hclk.elapsedTotalTime += arg
                hclk.elapsedMoveTime += arg
                ret = true
            }
        } else if (action === 'resetExpired') {
            if (hclk.state === 'expired') {
                this.adjIC({action: 'pause'})
                hclk.resetPeriod = false
                hclk.state = 'paused'
                ret = true
            }
        } else if (action === 'resetPeriod') {
            hclk.resetPeriod = true
            ret = true
        } else if (action === 'setElapsedMainTime') {
            if (arg != null) {
                hclk.elapsedMainTime = arg
                ret = true
            }
        } else if (action === 'setElapsedNumPeriods') {
            if (arg != null) {
                hclk.elapsedNumPeriods = arg
                ret = true
            }
        } else if (action === 'setElapsedPeriodMoves') {
            if (arg != null) {
                hclk.elapsedPeriodMoves = arg
                ret = true
            }
        } else if (action === 'setElapsedPeriodTime') {
            if (arg != null) {
                hclk.elapsedPeriodTime = arg
                ret = true
            }
        } else if (action === 'setElapsedTotalTime') {
            if (arg != null) {
                hclk.elapsedTotalTime = arg
                ret = true
            }
        } else if (action === 'setExpired') {
            hclk.state = 'expired'
            ret = true
        } else if (action === 'setTenCount') {
            if (arg != null) {
                hclk.didTenCount = arg
                ret = true
            }
        }

        return ret
    }

    expireTimer({nstate = null, nprops = null} = {}) {
        // only used from adjHybridIC
        this.stopTick({nstate: nstate, nprops: nprops})
        this.updateTimer({forced: true, nstate: nstate, nprops: nprops})
        this.handlePlayerClockExpired({nstate: nstate, nprops: nprops})
        return true
    }

    initTimer({nstate = null, nprops = null} = {}) {
        if (!nprops.clockMode || !nprops.initialTime) {
            return false
        }
        if (this.adjHybridIC({
            action: 'init',
            nstate: nstate,
            nprops: nprops
        })) {
            this.updateTimer({forced: true})
            this.handleInit({nstate: nstate, nprops: nprops})
            if (nprops.clockActive) {
                this.resumeTimer({nstate: nstate, nprops: nprops})
            }
            return true
        } else {
            return false
        }
    }

    madeAdjustTimer({nstate = null, nprops = null} = {}) {
        let validActions = [
            'incrElapsedMainTime',
            'incrElapsedNumPeriods',
            'incrElapsedPeriodMoves',
            'incrElapsedPeriodTime',
            'incrElapsedTotalTime',
            'setElapsedMainTime',
            'setElapsedNumPeriods',
            'setElapsedPeriodMoves',
            'setElapsedPeriodTime',
            'setElapsedTotalTime'
        ]

        if (validActions.indexOf(nprops.adjustAction) === -1) {
            return
        }
        let val = parseFloat(nprops.adjustVal)
        if (isNaN(val)) {
            return
        }
        if (this.adjHybridIC({
            action: nprops.adjustAction,
            arg: val,
            nstate: nstate,
            nprops: nprops
        })) {
            if (nprops.adjustAction.slice(-4) === 'Time') {
                // reset tenCount when adjusting clock time
                this.adjHybridIC({
                    action: 'setTenCount',
                    arg: false,
                    nstate: nstate,
                    nprops: nprops
                })
            }
            // if was in expired, check if we are no longer expired, then set paused
            let hclk = nstate.hybridClock
            let resetExpired = false
            if (hclk.state === 'expired') {
                let hasTimeLeft = false
                let mainTimeLeft = false
                let clockMode = nprops.clockMode
                let initTime = nprops.initialTime
                let initMainTime = initTime.mainTime
                let initPeriodTime = initTime.periodTime
                if (hclk.elapsedMainTime < initMainTime) {
                    mainTimeLeft = true
                }
                if (clockMode === 'absolutePerPlayer') {
                    hasTimeLeft = mainTimeLeft
                } else if (clockMode === 'byo-yomi') {
                    let periodsRemain = initTime.numPeriods - hclk.elapsedNumPeriods
                    if (periodsRemain > 0 && hclk.elapsedPeriodTime < initPeriodTime) {
                        hasTimeLeft = true
                    } else {
                        hasTimeLeft = mainTimeLeft
                    }
                }
                // no longer expired, set paused
                if (hasTimeLeft) {
                    this.adjHybridIC({
                        action: 'resetExpired',
                        nstate: nstate,
                        nprops: nprops
                    })
                    resetExpired = true
                }
            }
            this.handleAdjust({nstate: nstate, nprops: nprops, resetExpired: resetExpired})
        }
    }

    madeMoveTimer({nstate = null, nprops = null} = {}) {
        // first, check that time has not expired
        this.updateTimer({nstate: nstate, nprops: nprops})
        if (this.adjHybridIC({
            action: 'madeMove',
            nstate: nstate,
            nprops: nprops
        })) {
            this.pauseTimer({nstate: nstate, nprops: nprops})
            this.handleMadeMove({nstate: nstate, nprops: nprops})
            this.adjHybridIC({
                action: 'setElapsedMoveTime',
                arg: 0,
                nstate: nstate,
                nprops: nprops
            })
        } else {
            this.pauseTimer({nstate: nstate, nprops: nprops})
            this.handleMadeMove({nstate: nstate, nprops: nprops})
        }
    }

    pauseTimer({nstate = null, nprops = null} = {}) {
        this.updateTimer({nstate: nstate, nprops: nprops})
        let ret = true
        if (this.adjHybridIC({
            action: 'pause',
            nstate: nstate,
            nprops: nprops
        })) {
            ret = true
        } else {
            ret = false
        }
        this.stopTick({nstate: nstate, nprops: nprops})
        this.updateTimer({nstate: nstate, nprops: nprops})
        this.handlePaused({nstate: nstate, nprops: nprops})
        return ret
    }

    resetTimer({nstate = null, nprops = null} = {}) {
        // pause timer first to stop stick
        this.pauseTimer()
        if (this.adjHybridIC({
            action: 'reset',
            nstate: nstate,
            nprops: nprops
        })) {
            this.updateTimer({forced: true, nstate: nstate, nprops: nprops})
            this.handleReset({nstate: nstate, nprops: nprops})
            return true
        } else {
            return false
        }
    }

    resumeTimer({nstate = null, nprops = null} = {}) {
        if (this.adjHybridIC({
            action: 'resume',
            nstate: nstate,
            nprops: nprops
        })) {
            this.startTick({nstate: nstate, nprops: nprops})
            this.updateTimer({nstate: nstate, nprops: nprops})
            this.handleResumed({nstate: nstate, nprops: nprops})
            return true
        } else {
            this.updateTimer({nstate: nstate, nprops: nprops})
            return false
        }
    }

    updateTimer({forced = false, nstate = null, nprops = null} = {}) {
        if (nstate != null && nstate.hybridClock.state !== 'preinit') {
            let expired = this.adjHybridIC({
                action: 'update',
                nstate: nstate,
                nprops: nprops
            })
            if (expired || forced) {
                return true
            }
        }
        return false
    }

    calcTimeUntilNextWholeSecond({nstate = null, nprops = null} = {}) {
        let hclk = nstate.hybridClock
        if (hclk.state !== 'running') {
            return helper.secToMilli(1)
        }

        let clockMode = nprops.clockMode
        let initTime = nprops.initialTime
        let clk = this.internalClock
        let intervalEnd = clk.timeOnIntervalEnd

        let timeUntilNextSecond = 1
        let timeNow = helper.timeNow()

        if (clockMode === 'absolutePerPlayer') {
            let elapsedAtLastInterval = hclk.elapsedMainTime
            let timeSinceLastInterval = timeNow - intervalEnd
            let realElapsed = elapsedAtLastInterval + timeSinceLastInterval
            if (hclk.elapsedMainTime < initTime.mainTime) {
                if (nprops.dispFormatMainTimeFSNumDigits > 0) {
                    let updateInterval = nprops.dispFormatMainTimeFSUpdateInterval
                    if (updateInterval > 0) {
                        let lastNumSecs = nprops.dispFormatMainTimeFSLastNumSecs
                        if (!(lastNumSecs > 0)) {
                            lastNumSecs = Infinity
                        }
                        if ((initTime.mainTime - realElapsed) <= lastNumSecs) {
                            // update at steps of updateInterval
                            let fs = realElapsed - Math.floor(realElapsed)
                            timeUntilNextSecond = updateInterval - (fs % updateInterval)
                        }
                    }
                }
                timeUntilNextSecond = Math.min(timeUntilNextSecond,
                    Math.ceil(realElapsed) - realElapsed)
            }
        } else if (clockMode === 'byo-yomi') {
            let elapsedAtLastInterval
            let onMainTime
            if (hclk.elapsedMainTime < initTime.mainTime) {
                // on main time
                elapsedAtLastInterval = hclk.elapsedMainTime
                onMainTime = true
            } else {
                // on byo-yomi period time
                elapsedAtLastInterval = hclk.elapsedPeriodTime
                onMainTime = false
            }
            let timeSinceLastInterval = timeNow - intervalEnd
            let realElapsed = elapsedAtLastInterval + timeSinceLastInterval
            if (onMainTime && nprops.dispFormatMainTimeFSNumDigits > 0) {
                let updateInterval = nprops.dispFormatMainTimeFSUpdateInterval
                if (updateInterval > 0) {
                    let lastNumSecs = nprops.dispFormatMainTimeFSLastNumSecs
                    if (!(lastNumSecs > 0)) {
                        lastNumSecs = Infinity
                    }
                    if ((initTime.mainTime - realElapsed) <= lastNumSecs) {
                        // update at steps of updateInterval
                        let fs = realElapsed - Math.floor(realElapsed)
                        timeUntilNextSecond = updateInterval - (fs % updateInterval)
                    }
                }
            } else if (!onMainTime && nprops.dispFormatPeriodTimeFSNumDigits > 0) {
                let updateInterval = nprops.dispFormatPeriodTimeFSUpdateInterval
                if (updateInterval > 0) {
                    let lastNumSecs = nprops.dispFormatPeriodTimeFSLastNumSecs
                    if (!(lastNumSecs > 0)) {
                        lastNumSecs = Infinity
                    }
                    if ((initTime.periodTime - realElapsed) <= lastNumSecs) {
                        // update at steps of updateInterval
                        let fs = realElapsed - Math.floor(realElapsed)
                        timeUntilNextSecond = updateInterval - (fs % updateInterval)
                    }
                }
            }
            timeUntilNextSecond = Math.min(timeUntilNextSecond,
                Math.ceil(realElapsed) - realElapsed)
        }
        return helper.secToMilli(timeUntilNextSecond)
    }

    startTick({nstate = null, nprops = null} = {}) {
        this.cancelDispUpdate = false
        this.intervalID = requestAnimationFrame(this.tick)
    }

    stopTick({nstate = null, nprops = null} = {}) {
        this.cancelDispUpdate = true
        cancelAnimationFrame(this.intervalID)
        clearTimeout(this.timeoutID)
    }

    tick({nstate = null, nprops = null} = {}) {
        if (nstate == null) {
            nstate = helper.deepCopyIfSame({a: this.state, b: this.state})
        }
        if (nprops == null) {
            nprops = this.props
        }
        if (this.cancelDispUpdate) return
        this.updateTimer({nstate: nstate, nprops: nprops})

        // update state if changed
        this.setState({
            hybridClock: nstate.hybridClock
        })
        // start next tick
        this.timeoutID = setTimeout(() => {
            this.intervalID = requestAnimationFrame(this.tick)
        }, this.calcTimeUntilNextWholeSecond({nstate: nstate, nprops: nprops}))
    }

    handleAdjust({nstate = null, nprops = null, resetExpired = false} = {}) {
        let clock = nstate != null && nstate.hybridClock != null ?
            helper.deepCopyIfSame({
                a: nstate.hybridClock, b: nstate.hybridClock
            }) : null
        let playerID = nprops != null && nprops.playerID != null ?
            JSON.parse(JSON.stringify(nprops.playerID)) : null
        let adjustEventID = nprops != null && nprops.adjustEventID != null ?
            JSON.parse(JSON.stringify(nprops.adjustEventID)) : null
        if (nprops != null && nprops.handleInit != null) {
            nprops.handleAdjust({
                clock: clock,
                playerID: playerID,
                adjustEventID: adjustEventID,
                resetExpired: resetExpired
            })
        }
    }

    handleElapsedMainTime({nstate = null, nprops = null} = {}) {
        let clock = nstate != null && nstate.hybridClock != null ?
            helper.deepCopyIfSame({
                a: nstate.hybridClock, b: nstate.hybridClock
            }) : null
        let playerID = nprops != null && nprops.playerID != null ?
            JSON.parse(JSON.stringify(nprops.playerID)) : null
        if (nprops != null && nprops.handleElapsedMainTime != null) {
            nprops.handleElapsedMainTime({
                clock: clock,
                playerID: playerID
            })
        }
    }

    handleElapsedPeriod({nstate = null, nprops = null} = {}) {
        let clock = nstate != null && nstate.hybridClock != null ?
            helper.deepCopyIfSame({
                a: nstate.hybridClock, b: nstate.hybridClock
            }) : null
        let playerID = nprops != null && nprops.playerID != null ?
            JSON.parse(JSON.stringify(nprops.playerID)) : null
        if (nprops != null && nprops.handleElapsedPeriod != null) {
            nprops.handleElapsedPeriod({
                clock: clock,
                playerID: playerID
            })
        }
    }

    handleInit({nstate = null, nprops = null} = {}) {
        let clock = nstate != null && nstate.hybridClock != null ?
            helper.deepCopyIfSame({
                a: nstate.hybridClock, b: nstate.hybridClock
            }) : null
        let playerID = nprops != null && nprops.playerID != null ?
            JSON.parse(JSON.stringify(nprops.playerID)) : null
        if (nprops != null && nprops.handleInit != null) {
            nprops.handleInit({
                clock: clock,
                playerID: playerID
            })
        }
    }

    handleMadeMove({nstate = null, nprops = null} = {}) {
        let clock = nstate != null && nstate.hybridClock != null ?
            helper.deepCopyIfSame({
                a: nstate.hybridClock, b: nstate.hybridClock
            }) : null
        let playerID = nprops != null && nprops.playerID != null ?
            JSON.parse(JSON.stringify(nprops.playerID)) : null
        if (nprops != null && nprops.handleMadeMove != null) {
            nprops.handleMadeMove({
                clock: clock,
                playerID: playerID
            })
        }
    }

    handlePaused({nstate = null, nprops = null} = {}) {
        let clock = nstate != null && nstate.hybridClock != null ?
            helper.deepCopyIfSame({
                a: nstate.hybridClock, b: nstate.hybridClock
            }) : null
        let playerID = nprops != null && nprops.playerID != null ?
            JSON.parse(JSON.stringify(nprops.playerID)) : null
        if (nprops != null && nprops.handlePaused != null) {
            nprops.handlePaused({
                clock: clock,
                playerID: playerID
            })
        }
    }

    handlePlayerClockExpired({nstate = null, nprops = null} = {}) {
        let clock = nstate != null && nstate.hybridClock != null ?
            helper.deepCopyIfSame({
                a: nstate.hybridClock, b: nstate.hybridClock
            }) : null
        let playerID = nprops != null && nprops.playerID != null ?
            JSON.parse(JSON.stringify(nprops.playerID)) : null
        if (nprops != null && nprops.handlePlayerClockExpired != null) {
            nprops.handlePlayerClockExpired({
                clock: clock,
                playerID: playerID
            })
        }
    }

    handleReset({nstate = null, nprops = null} = {}) {
        let clock = nstate != null && nstate.hybridClock != null ?
            helper.deepCopyIfSame({
                a: nstate.hybridClock, b: nstate.hybridClock
            }) : null
        let playerID = nprops != null && nprops.playerID != null ?
            JSON.parse(JSON.stringify(nprops.playerID)) : null
        if (nprops != null && nprops.handleReset != null) {
            nprops.handleReset({
                clock: clock,
                playerID: playerID
            })
        }
    }

    handleResumed({nstate = null, nprops = null} = {}) {
        let clock = nstate != null && nstate.hybridClock != null ?
            helper.deepCopyIfSame({
                a: nstate.hybridClock, b: nstate.hybridClock
            }) : null
        let playerID = nprops != null && nprops.playerID != null ?
            JSON.parse(JSON.stringify(nprops.playerID)) : null
        if (nprops != null && nprops.handleResumed != null) {
            nprops.handleResumed({
                clock: clock,
                playerID: playerID
            })
        }
    }

    handleTenCount({nstate = null, nprops = null} = {}) {
        let clock = nstate != null && nstate.hybridClock != null ?
            helper.deepCopyIfSame({
                a: nstate.hybridClock, b: nstate.hybridClock
            }) : null
        let playerID = nprops != null && nprops.playerID != null ?
            JSON.parse(JSON.stringify(nprops.playerID)) : null
        if (nprops != null && nprops.handleTenCount != null) {
            nprops.handleTenCount({
                clock: clock,
                playerID: playerID
            })
        }
    }

    componentDidMount() {
        let nprops = this.props
        let nstate = {}
        this.initTimer({nprops: nprops, nstate: nstate})
        if (nprops != null && nprops.playerID != null &&
            nstate != null && nstate.hybridClock != null &&
            nprops.adjustEventID != null && nprops.adjustPlayerID != null &&
            nprops.adjustPlayerID === nprops.playerID) {

            this.madeAdjustTimer({nstate: nstate, nprops: nprops})
        }
        if (nprops != null && nprops.handleUpdated != null) {
            nprops.handleUpdated()
        }
        this.setState({
            hybridClock: nstate.hybridClock
        })
    }

    componentDidUpdate(prevProps) {
        let nstate = this.state
        let nprops = this.props

        nprops.handleUpdated()
        if (nprops != null && nprops.playerID != null &&
            nstate != null && nstate.hybridClock != null &&
            nprops.adjustEventID != null && nprops.adjustPlayerID != null &&
            nprops.adjustEventID != prevProps.adjustEventID &&
            nprops.adjustPlayerID === nprops.playerID) {

            nstate = helper.deepCopyIfSame({a: nstate, b: this.state})
            this.madeAdjustTimer({nstate: nstate, nprops: nprops})
        }

        if (nprops.numMoves != prevProps.numMoves &&
            nprops.numMoves > prevProps.numMoves) {

            // update timer to reflect new move (pausing the timer)
            nstate = helper.deepCopyIfSame({a: nstate, b: this.state})
            this.madeMoveTimer({nstate: nstate, nprops: nprops})
        }

        if (nprops.doReset !== prevProps.doReset &&
            nprops.doReset === true &&
            nprops.handleReset != null &&
            nprops.initialTime != null) {
            nstate = helper.deepCopyIfSame({a: nstate, b: this.state})
            this.resetTimer({nstate: nstate, nprops: nprops})
        }

        if (nprops.initialTime != null &&
            (
                nprops.initialTime.mainTime !== prevProps.initialTime.mainTime ||
                nprops.initialTime.numPeriods !== prevProps.initialTime.numPeriods ||
                nprops.initialTime.periodMoves !== prevProps.initialTime.periodMoves ||
                nprops.initialTime.periodTime !== prevProps.initialTime.periodTime
            )) {
            // do init on change of initial Time
            // first pause to stop clock tick
            nstate = helper.deepCopyIfSame({a: nstate, b: this.state})
            this.pauseTimer({nstate: nstate, nprops: nprops})
            this.initTimer({nstate: nstate, nprops: nprops})
        }

        if (nprops.clockActive !== prevProps.clockActive) {
            if (nprops.clockActive === false) {
                if (prevProps.clockActive) {
                    // pausing from (possible) manual gameclock pause
                    nstate = helper.deepCopyIfSame({a: nstate, b: this.state})
                    this.pauseTimer({nstate: nstate, nprops: nprops})
                }
            } else if (nprops.clockActive === true) {
                if (!this.resumeTimer({nstate: nstate, nprops: nprops})) {
                    // if could not resume, try init
                    nstate = helper.deepCopyIfSame({a: nstate, b: this.state})
                    this.initTimer({nstate: nstate, nprops: nprops})
                }
            }
        }

        // update state if changed
        if (nstate != this.state) {
            this.setState({
                hybridClock: nstate.hybridClock
            })
        }
    }

    componentWillUnmount() {
        this.stopTick({nstate: this.state, nprops: this.props})
    }

    shouldComponentUpdate(nextProps, nextState) {
        let {
            hybridClock
        } = this.state

        if (hybridClock !== nextState.hybridClock) return true
        if (hybridClock != null && nextState.hybridClock != null &&
            !helper.shallowEquals(hybridClock, nextState.hybridClock)) {
                return true
        }

        let {
            adjustAction,
            adjustEventID,
            adjustPlayerID,
            adjustVal,
            clockActive,
            clockMode,
            dispInfoNumPeriods,
            dispInfoPeriodMoves,
            dispInfoPlayerText,
            dispCountElapsedMainTime,
            dispCountElapsedNumPeriods,
            dispCountElapsedPeriodMoves,
            dispCountElapsedPeriodTime,
            dispFormatMainTimeFSNumDigits,
            dispFormatMainTimeFSLastNumSecs,
            dispFormatMainTimeFSUpdateInterval,
            dispFormatPeriodTimeFSNumDigits,
            dispFormatPeriodTimeFSLastNumSecs,
            dispFormatPeriodTimeFSUpdateInterval,
            dispOnExpired,
            doReset,
            fixedWidth,
            gameClockID,
            initialTime,
            handleAdjust,
            handleElapsedMainTime,
            handleElapsedPeriod,
            handleInit,
            handleMadeMove,
            handlePaused,
            handlePlayerClockExpired,
            handleReset,
            handleResumed,
            handleTenCount,
            handleUpdated,
            numMoves,
            playerID,
            playerText
        } = this.props

        if (numMoves !== nextProps.numMoves) return true

        if (adjustEventID !== nextProps.adjustEventID) return true
        if (clockActive !== nextProps.clockActive) return true
        if (clockMode !== nextProps.clockMode) return true
        if (doReset !== nextProps.doReset) return true
        if (dispInfoNumPeriods !== nextProps.dispInfoNumPeriods) return true
        if (dispInfoPeriodMoves !== nextProps.dispInfoPeriodMoves) return true
        if (dispInfoPlayerText !== nextProps.dispInfoPlayerText) return true
        if (dispCountElapsedMainTime !== nextProps.dispCountElapsedMainTime) return true
        if (dispCountElapsedNumPeriods !== nextProps.dispCountElapsedNumPeriods) return true
        if (dispCountElapsedPeriodMoves !== nextProps.dispCountElapsedPeriodMoves) return true
        if (dispCountElapsedPeriodTime !== nextProps.dispCountElapsedPeriodTime) return true
        if (dispFormatMainTimeFSNumDigits !== nextProps.dispFormatMainTimeFSNumDigits) return true
        if (dispFormatMainTimeFSLastNumSecs !== nextProps.dispFormatMainTimeFSLastNumSecs) return true
        if (dispFormatMainTimeFSUpdateInterval !== nextProps.dispFormatMainTimeFSUpdateInterval) return true
        if (dispFormatPeriodTimeFSNumDigits !== nextProps.dispFormatPeriodTimeFSNumDigits) return true
        if (dispFormatPeriodTimeFSLastNumSecs !== nextProps.dispFormatPeriodTimeFSLastNumSecs) return true
        if (dispFormatPeriodTimeFSUpdateInterval !== nextProps.dispFormatPeriodTimeFSUpdateInterval) return true
        if (dispOnExpired !== nextProps.dispOnExpired) return true
        if (fixedWidth !== nextProps.fixedWidth) return true
        if (gameClockID !== nextProps.gameClockID) return true
        if (handleAdjust !== nextProps.handleAdjust) return true
        if (handleElapsedMainTime !== nextProps.handleElapsedMainTime) return true
        if (handleElapsedPeriod !== nextProps.handleElapsedPeriod) return true
        if (handleInit !== nextProps.handleInit) return true
        if (handleMadeMove !== nextProps.handleMadeMove) return true
        if (handlePaused !== nextProps.handlePaused) return true
        if (handlePlayerClockExpired !== nextProps.handlePlayerClockExpired) return true
        if (handleReset !== nextProps.handleReset) return true
        if (handleResumed !== nextProps.handleResumed) return true
        if (handleTenCount !== nextProps.handleTenCount) return true
        if (handleUpdated !== nextProps.handleUpdated) return true
        if (playerID !== nextProps.playerID) return true
        if (playerText !== nextProps.playerText) return true

        if (initialTime !== nextProps.initialTime) return true
        if (initialTime != null && nextProps.initialTime != null &&
            !helper.shallowEquals(initialTime, nextProps.initialTime)) {
                return true
        }

        return false
    }

    render() {
        let {
            hybridClock
        } = this.state

        let {
            clockMode,
            clockActive,
            dispInfoNumPeriods,
            dispInfoPeriodMoves,
            dispInfoPlayerText,
            dispCountElapsedMainTime,
            dispCountElapsedNumPeriods,
            dispCountElapsedPeriodMoves,
            dispCountElapsedPeriodTime,
            dispFormatMainTimeFSNumDigits,
            dispFormatMainTimeFSLastNumSecs,
            dispFormatMainTimeFSUpdateInterval,
            dispFormatPeriodTimeFSNumDigits,
            dispFormatPeriodTimeFSLastNumSecs,
            dispFormatPeriodTimeFSUpdateInterval,
            dispOnExpired,
            doReset,
            fixedWidth,
            gameClockID,
            initialTime,
            numMoves,
            playerID,
            playerText,
        } = this.props

        let hybridClockHasState = hybridClock != null &&
                hybridClock.state != null
        let hclkState = hybridClockHasState ?
                hybridClock.state : null
        let hasInitTime = initialTime != null
        let hasTimerInit = hasInitTime && hybridClockHasState
        let mainTimeLeft = hasTimerInit ?
                initialTime.mainTime - hybridClock.elapsedMainTime : 0
        let hasMainTimeLeft = mainTimeLeft > 0
        let hasExpired = hasTimerInit &&
                hclkState === 'expired'
        let hasNotExpired = hasTimerInit &&
                hclkState !== 'expired'

        let isInactive = !clockActive && hybridClockHasState && (
                hclkState === 'preinit' ||
                hclkState === 'init' ||
                hclkState === 'reset')
        let isPaused = hasTimerInit && hybridClockHasState &&
                (!clockActive && (
                    hclkState === 'running' ||
                    hclkState === 'paused'
                    )
                )

        let displayByoYomi = (clockMode === 'byo-yomi') &&
                hasTimerInit && !hasMainTimeLeft
        let byoYomiPeriodTimeLeft = hasTimerInit ?
                initialTime.periodTime - hybridClock.elapsedPeriodTime : 0
        let byoYomiNumPeriodsLeft = hasTimerInit ?
                initialTime.numPeriods - hybridClock.elapsedNumPeriods : 0

        let mainLastNumSecs = dispFormatMainTimeFSLastNumSecs
        if (!(mainLastNumSecs > 0)) {
            mainLastNumSecs = Infinity
        }
        let periodLastNumSecs = dispFormatPeriodTimeFSLastNumSecs
        if (!(periodLastNumSecs > 0)) {
            periodLastNumSecs = Infinity
        }
        let onLastMainNumSecs = dispFormatMainTimeFSNumDigits > 0 ?
            (mainTimeLeft <= dispFormatMainTimeFSLastNumSecs) : false
        let onLastPeriodNumSecs = dispFormatPeriodTimeFSNumDigits > 0 ?
            (byoYomiPeriodTimeLeft <= dispFormatPeriodTimeFSLastNumSecs) : false

        let hasInfiniteMainTimeLeft = hasNotExpired &&
            mainTimeLeft == 'Infinity'
        let hasInfinitePeriodTimeLeft = hasNotExpired &&
            byoYomiPeriodTimeLeft == 'Infinity'
        let hasInfiniteTimeLeft = hasInfiniteMainTimeLeft ||
            hasInfinitePeriodTimeLeft == 'Infinity'

        let timeStr = ''
        if (dispInfoPlayerText) {
            timeStr += playerText + ' '
        }
        if (!hasTimerInit) {
            timeStr += '-'
        } else {
            if (hasExpired && dispOnExpired != null && dispOnExpired !== '') {
                fixedWidth -= helper.strlen(timeStr)
                timeStr += helper.padStart(String(dispOnExpired), fixedWidth, ' ')
            } else if (!displayByoYomi) {
                fixedWidth -= helper.strlen(timeStr)
                if (dispCountElapsedMainTime) {
                    timeStr += helper.timeToString(hybridClock.elapsedMainTime,
                        fixedWidth,
                        dispFormatMainTimeFSNumDigits,
                        onLastMainNumSecs)
                } else {
                    timeStr += helper.timeToString(mainTimeLeft,
                        fixedWidth,
                        dispFormatMainTimeFSNumDigits,
                        onLastMainNumSecs)
                }
            } else {
                if (dispInfoNumPeriods) {
                    timeStr += '(' +
                        (dispCountElapsedNumPeriods ?
                            hybridClock.elapsedNumPeriods :
                            byoYomiNumPeriodsLeft
                        )
                    + ') '
                }
                if (dispInfoPeriodMoves) {
                    timeStr += (dispCountElapsedPeriodMoves ?
                            hybridClock.elapsedPeriodMoves :
                            (initialTime.periodMoves -
                                hybridClock.elapsedPeriodMoves)
                        ) + '  '
                }
                fixedWidth -= helper.strlen(timeStr)
                if (dispCountElapsedPeriodTime) {
                    timeStr += helper.timeToString(hybridClock.elapsedPeriodTime,
                        fixedWidth,
                        dispFormatPeriodTimeFSNumDigits,
                        onLastPeriodNumSecs)
                } else {
                    timeStr += helper.timeToString(byoYomiPeriodTimeLeft,
                        fixedWidth,
                        dispFormatPeriodTimeFSNumDigits,
                        onLastPeriodNumSecs)
                }
            }
        }

        return h('div',
            {
                className: classnames(
                    'gameclock_' + gameClockID,
                    'playerclock',
                    'playerclock_' + gameClockID + '_' + playerID,
                    !hasNotExpired ? 'expired' : '',
                    !hasInfiniteTimeLeft && clockActive ? 'running' : '',
                    hasInfiniteTimeLeft && clockActive ? 'infinitetime' : '',
                    isPaused ? 'paused' : '',
                    isInactive ? 'inactive' : ''
                ),
                id: 'playerclock_' + gameClockID + '_' + playerID
            },
            timeStr
        )
    }
}

module.exports = playerclock

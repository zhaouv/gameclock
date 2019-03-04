const {h, render, Component} = require('preact')
const classnames = require('classnames')

const helper = require('./helper.js')

class playerclock extends Component {
    constructor(props) {
        super(props)

        // keeps track of the elaspsed time and clock state
        // aliased as hclk (hybrid clock)
        this.state = {
            didTenCount: false,
            elapsedMainTime: 0,
            elapsedMoveTime: 0,
            elapsedNumPeriods: 0,
            elapsedTotalTime: 0,
            elapsedPeriodMoves: 0,
            elapsedPeriodTime: 0,
            needIncrementBefore: false,
            resetPeriod: false,
            state: 'preinit'
        }

        // internalClock keeps absolute time reference points for hybridClock
        this.icState = 'preinit'
        this.icTimeOnIntervalEnd = null
        this.icTimeOnIntervalStart = null

        this.adjIC = this.adjIC.bind(this)
        this.getIntervalIC = this.getIntervalIC.bind(this)

        this.addElapsedHybridIC = this.addElapsedHybridIC.bind(this)
        this.adjHybridIC = this.adjHybridIC.bind(this)

        // helper for clock modes delay & increment
        this.getPhaseInfo = this.getPhaseInfo.bind(this)

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
        let ret = false
        if (action === 'update') {
            if (this.icState === 'running') {
                this.icTimeOnIntervalStart = this.icTimeOnIntervalEnd
                this.icTimeOnIntervalEnd = helper.timeNow()
                ret = true
            }
        } else if (action === 'pause') {
            if (this.icState === 'running') {
                this.icTimeOnIntervalEnd = helper.timeNow()
                this.icState = 'paused'
                ret = true
            }
        } else if (action === 'resume') {
            if (this.icState === 'paused') {
                let newTime = helper.timeNow()
                this.icTimeOnIntervalStart = newTime
                this.icTimeOnIntervalEnd = newTime
                this.icState = 'running'
                ret = true
            } else if (this.icState === 'init') {
                let newTime = helper.timeNow()
                this.icTimeOnIntervalStart = newTime
                this.icTimeOnIntervalEnd = newTime
                this.icState = 'running'
                ret = true
            }
        } else if (action === 'reset') {
            if (this.icState !== 'preinit') {
                this.icTimeOnIntervalStart = null
                this.icTimeOnIntervalEnd = null
                this.icState = 'init'
                ret = true
            }
        } else if (action === 'init') {
            this.icTimeOnIntervalStart = null
            this.icTimeOnIntervalEnd = null
            this.icState = 'init'
            ret = true
        }
        return ret
    }

    getIntervalIC() {
        let clk = this.internalClock
        let ret = null
        if (this.icState === 'paused' || this.icState === 'running') {
            ret = (this.icTimeOnIntervalEnd - this.icTimeOnIntervalStart)
        }
        return ret
    }

    addElapsedHybridIC({elapsed = null, madeMove = false, nstate = null, nprops = null} = {}) {
        // add time, update time, and...
        // check if time expired on: pausing, updating, or adding moves
        if (elapsed == null) {
            return
        }

        let hclk = nstate
        let initTime = nprops.initialTime
        let clockMode = nprops.clockMode

        let expired = false

        // add exact time used to elapsedTotalTime ...
        // can use it to calculate how much time player took to move
        // elapsedTotalTime is actual time taken, not zero when period not used in byo-yomi

        let initMainTime = initTime.mainTime
        let initPeriodTime = initTime.periodTime

        if (clockMode === 'absolutePerPlayer' || clockMode === 'hourglass') {
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
        } else if (clockMode === 'word') {
            let elapsedRemainder
            if (hclk.elapsedMainTime >= initMainTime) {
                elapsedRemainder = initMainTime - hclk.elapsedMainTime
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
            } else if ((hclk.elapsedMainTime + elapsed) >= initMainTime) {
                // will use up main time
                elapsedRemainder = initMainTime - hclk.elapsedMainTime
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
                this.handleElapsedMainTime({nstate: nstate, nprops: nprops})
            } else {
                elapsedRemainder = 0
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
            elapsedRemainder = elapsed - elapsedRemainder
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
        } else if (clockMode === 'incrementAfter' ||
            clockMode === 'incrementBefore') {

            // need to check first if expired already
            let {
                phase,
                phaseInitTime,
                phaseMoves,
                onLastPhase,
                totalPhases
            } = this.getPhaseInfo({hclk: hclk, initTime: initTime})

            if (hclk.elapsedMainTime >= phaseInitTime) {
                // phase time expired already
                if (onLastPhase ||
                    !(hclk.elapsedPeriodMoves >= phaseMoves)) {
                    // all time used up, or min. number of moves not made
                    this.adjHybridIC({
                        action: 'setExpired',
                        nstate: nstate,
                        nprops: nprops
                    })
                    if (!expired) {
                        this.handleElapsedMainTime({nstate: nstate, nprops: nprops})
                    }
                    expired = true
                }
            }

            let elapsedRemainder = elapsed

            while (elapsedRemainder > 0) {
                let {
                    phase,
                    phaseInitTime,
                    phaseMoves,
                    onLastPhase,
                    totalPhases
                } = this.getPhaseInfo({hclk: hclk, initTime: initTime})

                if (hclk.elapsedMainTime >= phaseInitTime) {
                    // phase time expired already
                    if (onLastPhase ||
                        !(hclk.elapsedPeriodMoves >= phaseMoves)) {
                        // all time used up, or min. number of moves not made
                        this.adjHybridIC({
                            action: 'setExpired',
                            nstate: nstate,
                            nprops: nprops
                        })
                        if (!expired) {
                            this.handleElapsedMainTime({nstate: nstate, nprops: nprops})
                        }
                        expired = true
                        break
                    } else {
                        // should not reach here unless by manual adjustment
                        // advance to next phase
                        phase++
                        // elapsedRemainder taken care of in next loop
                        this.adjHybridIC({
                            action: 'setElapsedMainTime',
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
                            action: 'setElapsedNumPeriods',
                            arg: phase,
                            nstate: nstate,
                            nprops: nprops
                        })
                    }
                } else if ((hclk.elapsedMainTime + elapsedRemainder) >= phaseInitTime) {
                    let diff = (phaseInitTime - hclk.elapsedMainTime)
                    this.adjHybridIC({
                        action: 'incrElapsedTotalTime',
                        arg: diff,
                        nstate: nstate,
                        nprops: nprops
                    })
                    this.adjHybridIC({
                        action: 'incrElapsedMainTime',
                        arg: diff,
                        nstate: nstate,
                        nprops: nprops
                    })
                    this.handleElapsedMainTime({nstate: nstate, nprops: nprops})

                    elapsedRemainder = elapsedRemainder - diff

                    if (onLastPhase ||
                        !(hclk.elapsedPeriodMoves >= phaseMoves)) {
                        // all time used up, or min. number of moves not made
                        expired = true
                        this.adjHybridIC({
                            action: 'setExpired',
                            nstate: nstate,
                            nprops: nprops
                        })
                        break
                    } else {
                        // advance to next phase
                        phase++
                        // elapsedRemainder taken care of in next loop
                        this.adjHybridIC({
                            action: 'setElapsedMainTime',
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
                            action: 'setElapsedNumPeriods',
                            arg: phase,
                            nstate: nstate,
                            nprops: nprops
                        })
                    }
                } else {
                    // will not use up phase time
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
                    elapsedRemainder = 0
                }
            }

            if (!expired && madeMove && !(hclk.resetPeriod === true)) {
                this.adjHybridIC({
                    action: 'incrElapsedPeriodMoves',
                    nstate: nstate,
                    nprops: nprops
                })
                let {
                    phase,
                    phaseInitTime,
                    phaseMoves,
                    onLastPhase,
                    totalPhases
                } = this.getPhaseInfo({hclk: hclk, initTime: initTime})

                if (hclk.elapsedPeriodMoves >= phaseMoves) {
                    // advance to next phase if there is a next phase
                    if (phase < (totalPhases - 1)) {
                        // moved to next phase
                        // add remaining time in phase as spillover time
                        phase++
                        let spilloverTime = phaseInitTime - hclk.elapsedMainTime
                        if (spilloverTime > 0) {
                            // add spillover as negative elapsed main time
                            this.adjHybridIC({
                                action: 'setElapsedMainTime',
                                arg: (-spilloverTime),
                                nstate: nstate,
                                nprops: nprops
                            })
                        }
                        this.adjHybridIC({
                            action: 'setElapsedPeriodMoves',
                            arg: 0,
                            nstate: nstate,
                            nprops: nprops
                        })
                        this.adjHybridIC({
                            action: 'setElapsedNumPeriods',
                            arg: phase,
                            nstate: nstate,
                            nprops: nprops
                        })
                    }
                }
                if (clockMode === 'incrementAfter') {
                    // increment after
                    this.adjHybridIC({
                        action: 'incrElapsedMainTime',
                        arg: (-initPeriodTime),
                        nstate: nstate,
                        nprops: nprops
                    })
                }
                this.adjHybridIC({
                    action: 'resetPeriod',
                    nstate: nstate,
                    nprops: nprops
                })
            }
        } else if (clockMode === 'delay') {
            let elapsedRemainder = 0
            if (!(hclk.resetPeriod === true)) {
                if (hclk.elapsedPeriodTime >= initPeriodTime) {
                    // delay time has already elapsed
                    elapsedRemainder = elapsed
                } else if ((hclk.elapsedPeriodTime + elapsed) >= initPeriodTime) {
                    // delay time will elapse now
                    this.adjHybridIC({
                        action: 'incrElapsedTotalTime',
                        arg: (initPeriodTime - hclk.elapsedPeriodTime),
                        nstate: nstate,
                        nprops: nprops
                    })
                    this.adjHybridIC({
                        action: 'incrElapsedPeriodTime',
                        arg: (initPeriodTime - hclk.elapsedPeriodTime),
                        nstate: nstate,
                        nprops: nprops
                    })
                    elapsedRemainder = ((hclk.elapsedPeriodTime + elapsed) - initPeriodTime)
                } else {
                    elapsedRemainder = 0
                    expired = false
                    // delay time not elapsed yet
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

            // need to check first if expired already
            let {
                phase,
                phaseInitTime,
                phaseMoves,
                onLastPhase,
                totalPhases
            } = this.getPhaseInfo({hclk: hclk, initTime: initTime})

            if (hclk.elapsedMainTime >= phaseInitTime) {
                // phase time expired already
                if (onLastPhase ||
                    !(hclk.elapsedPeriodMoves >= phaseMoves)) {
                    // all time used up, or min. number of moves not made
                    this.adjHybridIC({
                        action: 'setExpired',
                        nstate: nstate,
                        nprops: nprops
                    })
                    if (!expired) {
                        this.handleElapsedMainTime({nstate: nstate, nprops: nprops})
                    }
                    expired = true
                }
            }

            while (elapsedRemainder > 0) {
                let {
                    phase,
                    phaseInitTime,
                    phaseMoves,
                    onLastPhase,
                    totalPhases
                } = this.getPhaseInfo({hclk: hclk, initTime: initTime})

                if (hclk.elapsedMainTime >= phaseInitTime) {
                    // phase time expired already
                    if (onLastPhase ||
                        !(hclk.elapsedPeriodMoves >= phaseMoves)) {
                        // all time used up, or min. number of moves not made
                        this.adjHybridIC({
                            action: 'setExpired',
                            nstate: nstate,
                            nprops: nprops
                        })
                        if (!expired) {
                            this.handleElapsedMainTime({nstate: nstate, nprops: nprops})
                        }
                        expired = true
                        break
                    } else {
                        // should not reach here unless by manual adjustment
                        // advance to next phase
                        phase++
                        // elapsedRemainder taken care of in next loop
                        this.adjHybridIC({
                            action: 'setElapsedMainTime',
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
                            action: 'setElapsedNumPeriods',
                            arg: phase,
                            nstate: nstate,
                            nprops: nprops
                        })
                    }
                } else if ((hclk.elapsedMainTime + elapsedRemainder) >= phaseInitTime) {
                    let diff = (phaseInitTime - hclk.elapsedMainTime)
                    this.adjHybridIC({
                        action: 'incrElapsedTotalTime',
                        arg: diff,
                        nstate: nstate,
                        nprops: nprops
                    })
                    this.adjHybridIC({
                        action: 'incrElapsedMainTime',
                        arg: diff,
                        nstate: nstate,
                        nprops: nprops
                    })
                    this.handleElapsedMainTime({nstate: nstate, nprops: nprops})

                    elapsedRemainder = elapsedRemainder - diff

                    if (onLastPhase ||
                        !(hclk.elapsedPeriodMoves >= phaseMoves)) {
                        // all time used up, or min. number of moves not made
                        expired = true
                        this.adjHybridIC({
                            action: 'setExpired',
                            nstate: nstate,
                            nprops: nprops
                        })
                        break
                    } else {
                        // advance to next phase
                        phase++
                        // elapsedRemainder taken care of in next loop
                        this.adjHybridIC({
                            action: 'setElapsedMainTime',
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
                            action: 'setElapsedNumPeriods',
                            arg: phase,
                            nstate: nstate,
                            nprops: nprops
                        })
                    }
                } else {
                    // will not use up phase time
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
                    elapsedRemainder = 0
                }
            }

            if (!expired && madeMove && !(hclk.resetPeriod === true)) {
                this.adjHybridIC({
                    action: 'incrElapsedPeriodMoves',
                    nstate: nstate,
                    nprops: nprops
                })
                let {
                    phase,
                    phaseInitTime,
                    phaseMoves,
                    onLastPhase,
                    totalPhases
                } = this.getPhaseInfo({hclk: hclk, initTime: initTime})

                if (hclk.elapsedPeriodMoves >= phaseMoves) {
                    // advance to next phase if there is a next phase
                    if (phase < (totalPhases - 1)) {
                        // moved to next phase
                        // add remaining time in phase as spillover time
                        phase++
                        let spilloverTime = phaseInitTime - hclk.elapsedMainTime
                        if (spilloverTime > 0) {
                            // add spillover as negative elapsed main time
                            this.adjHybridIC({
                                action: 'setElapsedMainTime',
                                arg: (-spilloverTime),
                                nstate: nstate,
                                nprops: nprops
                            })
                        }
                        this.adjHybridIC({
                            action: 'setElapsedPeriodMoves',
                            arg: 0,
                            nstate: nstate,
                            nprops: nprops
                        })
                        this.adjHybridIC({
                            action: 'setElapsedNumPeriods',
                            arg: phase,
                            nstate: nstate,
                            nprops: nprops
                        })
                    }
                }
                this.adjHybridIC({
                    action: 'setElapsedPeriodTime',
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
        let hclk = nstate
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
        let hclk = nstate
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
        let hclk = nstate
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
        let hclk = nstate
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
        let hclk = nstate
        let ret = false
        if (action === 'update') {
            // update time & check if expired
            if (hclk.state === 'running') {
                if (this.adjIC({action: 'update'})) {
                    let interval = this.getIntervalIC()
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
            if (nprops.clockMode === 'incrementBefore') {
                hclk.needIncrementBefore = true
            }
            if (hclk.state === 'running') {
                // must use updateTimer prior to madeMove
                let expired = this.addElapsedHybridIC({
                    elapsed: 0,
                    madeMove: true,
                    nstate: nstate,
                    nprops: nprops
                })
                if (expired) {
                    if (nprops.clockMode === 'incrementBefore') {
                        hclk.needIncrementBefore = false
                    }
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
                    let interval = this.getIntervalIC()
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
                hclk.needIncrementBefore = true
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
                hclk.needIncrementBefore = true
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
        } else if (action === 'setElapsedMoveTime') {
            if (arg != null) {
                hclk.elapsedMoveTime = arg
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

    getPhaseInfo({hclk = null, initTime = null} = {}) {
        // need to check first if expired already
        if (hclk === null || initTime == null) {
            let phaseInfo = {
                phase: 0,
                phaseInitTime: 0,
                phaseMoves: 0,
                onLastPhase: false,
                totalPhases: 0
            }
            return phaseInfo
        }
        let phase = hclk.elapsedNumPeriods
        let phaseMoves = initTime.mainMoves
        let totalPhases = 1
        let phaseInitTime = initTime.mainTime
        if (initTime.secondaryTime != null &&
            initTime.secondaryTime >= 0) {

            totalPhases++
            if (phase == 1) {
                phaseInitTime = initTime.secondaryTime
                if (initTime.secondaryMoves != null &&
                    initTime.secondaryMoves > 0) {

                    phaseMoves = initTime.secondaryMoves
                }
            }
        }
        if (initTime.tertiaryTime != null
            && initTime.tertiaryTime >= 0) {

            totalPhases++
            if (phase == 2) {
                phaseInitTime = initTime.tertiaryTime
                if (initTime.tertiaryMoves != null &&
                    initTime.tertiaryMoves > 0) {

                    phaseMoves = initTime.tertiaryMoves
                }
            }
        }

        let onLastPhase = (phase === (totalPhases - 1))
        let phaseInfo = {
            phase: phase,
            phaseInitTime: phaseInitTime,
            phaseMoves: phaseMoves,
            onLastPhase: onLastPhase,
            totalPhases: totalPhases
        }
        return phaseInfo
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
            if (nprops.clockMode === 'incrementAfter') {
                this.adjHybridIC({
                    action: 'incrElapsedMainTime',
                    arg: (-nprops.initialTime.periodTime),
                    nstate: nstate,
                    nprops: nprops
                })
            }
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

    madeAdjustTimer({nstate = null, nprops = null, byHourglass = false} = {}) {
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

        let action = (byHourglass === true ?
            'incrElapsedMainTime' : nprops.adjustAction)

        if (validActions.indexOf(action) === -1) {
            return
        }
        let val = (byHourglass === true ?
            nprops.hourglassAdjTime : parseFloat(nprops.adjustVal))
        if (isNaN(val)) {
            return
        }
        if (this.adjHybridIC({
            action: action,
            arg: val,
            nstate: nstate,
            nprops: nprops
        })) {
            if (action.slice(-4) === 'Time') {
                // reset tenCount when adjusting clock time
                this.adjHybridIC({
                    action: 'setTenCount',
                    arg: false,
                    nstate: nstate,
                    nprops: nprops
                })
            }
            // if was in expired, check if we are no longer expired, then set paused
            let hclk = nstate
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
                if (clockMode === 'absolutePerPlayer' ||
                    clockMode === 'hourglass' ||
                    clockMode === 'word') {

                    hasTimeLeft = mainTimeLeft
                } else if (clockMode === 'delay' ||
                    clockMode === 'incrementAfter' ||
                    clockMode === 'incrementBefore') {

                    let {
                        phase,
                        phaseInitTime,
                        phaseMoves,
                        onLastPhase,
                        totalPhases
                    } = this.getPhaseInfo({hclk: hclk, initTime: initTime})

                    if (hclk.elapsedMainTime < phaseInitTime) {
                        mainTimeLeft = true
                    }

                    if (clockMode === 'delay' &&
                        initPeriodTime != null &&
                        hclk.elapsedPeriodTime < initPeriodTime) {

                        hasTimeLeft = true
                    } else if (!onLastPhase) {
                        hasTimeLeft = true
                    } else {
                        hasTimeLeft = mainTimeLeft
                    }
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
            this.handleAdjust({
                nstate: nstate,
                nprops: nprops,
                byHourglass: byHourglass,
                resetExpired: resetExpired})
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
            if (nprops.clockMode === 'incrementAfter') {
                this.adjHybridIC({
                    action: 'incrElapsedMainTime',
                    arg: (-nprops.initialTime.periodTime),
                    nstate: nstate,
                    nprops: nprops
                })
            }
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
            let hclk = nstate
            if (nprops.clockMode === 'incrementBefore' &&
                hclk.needIncrementBefore) {

                this.adjHybridIC({
                    action: 'incrElapsedMainTime',
                    arg: (-nprops.initialTime.periodTime),
                    nstate: nstate,
                    nprops: nprops
                })
                hclk.needIncrementBefore = false
            }
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
        let hclk = nstate
        if (hclk != null && hclk.state !== 'preinit') {
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
        let hclk = nstate
        if (hclk.state !== 'running') {
            return helper.secToMilli(1)
        }

        let clockMode = nprops.clockMode
        let initTime = nprops.initialTime
        let clk = this.internalClock
        let intervalEnd = this.icTimeOnIntervalEnd

        let timeUntilNextSecond = 1
        let timeNow = helper.timeNow()

        if (clockMode === 'absolutePerPlayer' ||
            clockMode === 'hourglass' ||
            clockMode === 'word') {

            let elapsedAtLastInterval = hclk.elapsedMainTime
            let timeSinceLastInterval = timeNow - intervalEnd
            let realElapsed = elapsedAtLastInterval + timeSinceLastInterval
            if (hclk.elapsedMainTime < initTime.mainTime ||
                clockMode === 'word') {

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
        } else if (clockMode === 'incrementAfter' ||
            clockMode === 'incrementBefore') {

            let elapsedAtLastInterval = hclk.elapsedMainTime
            let timeSinceLastInterval = timeNow - intervalEnd
            let realElapsed = elapsedAtLastInterval + timeSinceLastInterval
            if (nprops.dispFormatMainTimeFSNumDigits > 0) {
                let updateInterval = nprops.dispFormatMainTimeFSUpdateInterval
                if (updateInterval > 0) {
                    let lastNumSecs = nprops.dispFormatMainTimeFSLastNumSecs
                    if (!(lastNumSecs > 0)) {
                        lastNumSecs = Infinity
                    }

                    let {
                        phase,
                        phaseInitTime,
                        phaseMoves,
                        onLastPhase,
                        totalPhases
                    } = this.getPhaseInfo({hclk: hclk, initTime: initTime})

                    if ((phaseInitTime - realElapsed) <= lastNumSecs) {
                        // update at steps of updateInterval
                        let fs = realElapsed - Math.floor(realElapsed)
                        timeUntilNextSecond = updateInterval - (fs % updateInterval)
                    }
                }
            }
            timeUntilNextSecond = Math.min(timeUntilNextSecond,
                Math.ceil(realElapsed) - realElapsed)
        } else if (clockMode === 'delay') {
            let initPeriodTime = initTime.periodTime
            let onDelayTime
            let elapsedAtLastInterval
            if (initPeriodTime != null &&
                hclk.elapsedPeriodTime < initPeriodTime) {

                elapsedAtLastInterval = hclk.elapsedPeriodTime
                onDelayTime = true
            } else {
                elapsedAtLastInterval = hclk.elapsedMainTime
                onDelayTime = false
            }

            let timeSinceLastInterval = timeNow - intervalEnd
            let realElapsed = elapsedAtLastInterval + timeSinceLastInterval
            if (!onDelayTime && nprops.dispFormatMainTimeFSNumDigits > 0) {
                let updateInterval = nprops.dispFormatMainTimeFSUpdateInterval
                if (updateInterval > 0) {
                    let lastNumSecs = nprops.dispFormatMainTimeFSLastNumSecs
                    if (!(lastNumSecs > 0)) {
                        lastNumSecs = Infinity
                    }

                    let {
                        phase,
                        phaseInitTime,
                        phaseMoves,
                        onLastPhase,
                        totalPhases
                    } = this.getPhaseInfo({hclk: hclk, initTime: initTime})

                    if ((phaseInitTime - realElapsed) <= lastNumSecs) {
                        // update at steps of updateInterval
                        let fs = realElapsed - Math.floor(realElapsed)
                        timeUntilNextSecond = updateInterval - (fs % updateInterval)
                    }
                }
            } else if (onDelayTime && nprops.dispFormatPeriodTimeFSNumDigits > 0) {
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
            didTenCount: nstate.didTenCount,
            elapsedMainTime: nstate.elapsedMainTime,
            elapsedMoveTime: nstate.elapsedMoveTime,
            elapsedNumPeriods: nstate.elapsedNumPeriods,
            elapsedTotalTime: nstate.elapsedTotalTime,
            elapsedPeriodMoves: nstate.elapsedPeriodMoves,
            elapsedPeriodTime: nstate.elapsedPeriodTime,
            needIncrementBefore: nstate.needIncrementBefore,
            resetPeriod: nstate.resetPeriod,
            state: nstate.state
        })
        // start next tick
        this.timeoutID = setTimeout(() => {
            this.intervalID = requestAnimationFrame(this.tick)
        }, this.calcTimeUntilNextWholeSecond({nstate: nstate, nprops: nprops}))
    }

    handleAdjust({nstate = null, nprops = null, resetExpired = false, byHourglass = false} = {}) {
        let clock = nstate != null ?
            helper.deepCopyIfSame({
                a: nstate, b: nstate
            }) : null
        let playerID = nprops != null && nprops.playerID != null ?
            JSON.parse(JSON.stringify(nprops.playerID)) : null
        let eventID
        if (byHourglass === true) {
            eventID = nprops != null && nprops.hourglassEventID != null ?
                JSON.parse(JSON.stringify(nprops.hourglassEventID)) : null
        } else {
            eventID = nprops != null && nprops.adjustEventID != null ?
                JSON.parse(JSON.stringify(nprops.adjustEventID)) : null
        }
        if (nprops != null && nprops.handleAdjust != null) {
            nprops.handleAdjust({
                clock: clock,
                playerID: playerID,
                eventID: eventID,
                byHourglass: byHourglass,
                resetExpired: resetExpired
            })
        }
    }

    handleElapsedMainTime({nstate = null, nprops = null} = {}) {
        let clock = nstate != null ?
            helper.deepCopyIfSame({
                a: nstate, b: nstate
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
        let clock = nstate != null ?
            helper.deepCopyIfSame({
                a: nstate, b: nstate
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
        let clock = nstate != null ?
            helper.deepCopyIfSame({
                a: nstate, b: nstate
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
        let clock = nstate != null ?
            helper.deepCopyIfSame({
                a: nstate, b: nstate
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
        let clock = nstate != null ?
            helper.deepCopyIfSame({
                a: nstate, b: nstate
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
        let clock = nstate != null ?
            helper.deepCopyIfSame({
                a: nstate, b: nstate
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
        let clock = nstate != null ?
            helper.deepCopyIfSame({
                a: nstate, b: nstate
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
        let clock = nstate != null ?
            helper.deepCopyIfSame({
                a: nstate, b: nstate
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
        let clock = nstate != null ?
            helper.deepCopyIfSame({
                a: nstate, b: nstate
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
            nstate != null) {

            if (nprops.adjustEventID != null &&
                nprops.adjustPlayerID != null &&
                nprops.adjustPlayerID === nprops.playerID) {

                this.madeAdjustTimer({nstate: nstate, nprops: nprops})
            }

            if (nprops.hourglassEventID != null &&
                nprops.hourglassPlayerID != null &&
                nprops.hourglassPlayerID === nprops.playerID) {

                this.madeAdjustTimer({
                    nstate: nstate, nprops: nprops, byHourglass: true})
            }
        }

        if (nprops != null && nprops.handleUpdated != null) {
            nprops.handleUpdated()
        }
        this.setState({
            didTenCount: nstate.didTenCount,
            elapsedMainTime: nstate.elapsedMainTime,
            elapsedMoveTime: nstate.elapsedMoveTime,
            elapsedNumPeriods: nstate.elapsedNumPeriods,
            elapsedTotalTime: nstate.elapsedTotalTime,
            elapsedPeriodMoves: nstate.elapsedPeriodMoves,
            elapsedPeriodTime: nstate.elapsedPeriodTime,
            needIncrementBefore: nstate.needIncrementBefore,
            resetPeriod: nstate.resetPeriod,
            state: nstate.state
        })
    }

    componentDidUpdate(prevProps) {
        let nstate = this.state
        let nprops = this.props

        nprops.handleUpdated()
        if (nprops != null && nprops.playerID != null &&
            nstate != null) {

            if (nprops.adjustEventID != null &&
                nprops.adjustPlayerID != null &&
                nprops.adjustEventID != prevProps.adjustEventID &&
                nprops.adjustPlayerID === nprops.playerID) {

                nstate = helper.deepCopyIfSame({a: nstate, b: this.state})
                this.madeAdjustTimer({nstate: nstate, nprops: nprops})
            }

            if (nprops.hourglassEventID != null &&
                nprops.hourglassPlayerID != null &&
                nprops.hourglassEventID != prevProps.hourglassEventID &&
                nprops.hourglassPlayerID === nprops.playerID) {

                nstate = helper.deepCopyIfSame({a: nstate, b: this.state})
                this.madeAdjustTimer({
                    nstate: nstate, nprops: nprops, byHourglass: true})
            }
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
                nprops.initialTime.periodTime !== prevProps.initialTime.periodTime ||
                nprops.clockMode !== prevProps.clockMode
            )) {
            // do init on change of initial Time / clockMode
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
                // need a flag to know whether this is the start of a turn or manual resume
                nstate = helper.deepCopyIfSame({a: nstate, b: this.state})
                if (!this.resumeTimer({nstate: nstate, nprops: nprops})) {
                    // if could not resume, try init
                    this.initTimer({nstate: nstate, nprops: nprops})
                }
            }
        }

        // update state if changed
        if (nstate != this.state) {
            this.setState({
                didTenCount: nstate.didTenCount,
                elapsedMainTime: nstate.elapsedMainTime,
                elapsedMoveTime: nstate.elapsedMoveTime,
                elapsedNumPeriods: nstate.elapsedNumPeriods,
                elapsedTotalTime: nstate.elapsedTotalTime,
                elapsedPeriodMoves: nstate.elapsedPeriodMoves,
                elapsedPeriodTime: nstate.elapsedPeriodTime,
                needIncrementBefore: nstate.needIncrementBefore,
                resetPeriod: nstate.resetPeriod,
                state: nstate.state
            })
        }
    }

    componentWillUnmount() {
        this.stopTick({nstate: this.state, nprops: this.props})
    }

    shouldComponentUpdate(nextProps, nextState) {
        if (this.state !== nextState) return true
        if (this.state != null &&
            !helper.shallowEquals(this.state, nextState)) {
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
            fixedNumPeriodsWidth,
            fixedPeriodMovesWidth,
            fixedPeriodWidth,
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
            hourglassAdjTime,
            hourglassEventID,
            hourglassPlayerID,
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
        if (fixedNumPeriodsWidth !== nextProps.fixedNumPeriodsWidth) return true
        if (fixedPeriodMovesWidth !== nextProps.fixedPeriodMovesWidth) return true
        if (fixedPeriodWidth !== nextProps.fixedPeriodWidth) return true
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
        if (hourglassEventID !== nextProps.hourglassEventID) return true
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
        let hclk = this.state

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
            fixedNumPeriodsWidth,
            fixedPeriodMovesWidth,
            fixedPeriodWidth,
            fixedWidth,
            gameClockID,
            initialTime,
            numMoves,
            playerID,
            playerText,
        } = this.props

        let hclkHasState = hclk != null && hclk.state != null
        let hclkState = hclkHasState ? hclk.state : null
        let initTime = initialTime
        let hasInitTime = initTime != null
        let hasTimerInit = hasInitTime && hclkHasState

        let displayDelay = false
        let displayIncrement = false

        let hasPositiveInitPeriodTime = (hasTimerInit &&
            initTime.periodTime != null &&
            initTime.periodTime > 0)

        let mainTime,
            numPhasesLeft,
            phase,
            phaseInitTime,
            phaseMoves,
            onLastPhase,
            totalPhases

        if (clockMode === 'delay' ||
            clockMode === 'incrementAfter' ||
            clockMode === 'incrementBefore') {

            ({
                phase,
                phaseInitTime,
                phaseMoves,
                onLastPhase,
                totalPhases
            } = this.getPhaseInfo({hclk: hclk, initTime: initTime}))

            numPhasesLeft = hasTimerInit ?
                    totalPhases - hclk.elapsedNumPeriods : 0

            if (clockMode === 'delay') {
                displayDelay = true
            } else if (clockMode === 'incrementAfter' ||
                clockMode === 'incrementBefore') {

                displayIncrement = true
            }
            mainTime = phaseInitTime
        } else {
            mainTime = hasTimerInit ? initTime.mainTime : 0
        }

        let mainTimeLeft = hasTimerInit ?
                mainTime - hclk.elapsedMainTime : 0
        let hasMainTimeLeft = mainTimeLeft > 0
        let hasExpired = hasTimerInit &&
                hclkState === 'expired'
        let hasNotExpired = hasTimerInit &&
                hclkState !== 'expired'

        let isInactive = !clockActive && hclkHasState && (
                hclkState === 'preinit' ||
                hclkState === 'init' ||
                hclkState === 'reset')
        let isPaused = hasTimerInit && hclkHasState &&
                (!clockActive && (
                    hclkState === 'running' ||
                    hclkState === 'paused'
                    )
                )

        let periodTimeLeft = hasTimerInit ?
            initTime.periodTime - hclk.elapsedPeriodTime : 0

        let displayByoYomi = (clockMode === 'byo-yomi') &&
                hasTimerInit && !hasMainTimeLeft

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
            (periodTimeLeft <= dispFormatPeriodTimeFSLastNumSecs) : false

        let hasInfiniteMainTimeLeft = hasNotExpired &&
            mainTimeLeft == 'Infinity'
        let hasInfinitePeriodTimeLeft = hasNotExpired &&
            periodTimeLeft == 'Infinity'
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
            } else if (displayByoYomi) {
                if (dispInfoNumPeriods) {
                    let byoYomiNumPeriodsLeft = hasTimerInit ?
                            initTime.numPeriods - hclk.elapsedNumPeriods : 0

                    let periods = (dispCountElapsedNumPeriods ?
                        hclk.elapsedNumPeriods :
                        byoYomiNumPeriodsLeft)

                    timeStr += '(' + helper.padStart(
                        String(periods), fixedNumPeriodsWidth, ' ') + ') '
                }
                if (dispInfoPeriodMoves) {
                    let periodMoves = (dispCountElapsedPeriodMoves ?
                            hclk.elapsedPeriodMoves :
                            (initTime.periodMoves -
                                hclk.elapsedPeriodMoves))

                    timeStr += helper.padStart(
                        String(periodMoves), fixedPeriodMovesWidth, ' ') + '  '
                }
                fixedWidth -= helper.strlen(timeStr)

                let periodTime = (dispCountElapsedPeriodTime ?
                    hclk.elapsedPeriodTime :
                    periodTimeLeft)

                timeStr += helper.timeToString(periodTime,
                    fixedWidth,
                    dispFormatPeriodTimeFSNumDigits,
                    onLastPeriodNumSecs)
            } else if (displayIncrement) {
                if (dispInfoNumPeriods) {
                    let periods = dispCountElapsedNumPeriods ?
                        (hclk.elapsedNumPeriods + 1) :
                        (numPhasesLeft - 1)

                    timeStr += '(' + helper.padStart(
                        String(periods), fixedNumPeriodsWidth, ' ') + ') '
                }
                if (dispInfoPeriodMoves) {
                    let phaseMovesLeft = (phaseMoves -
                        hclk.elapsedPeriodMoves)
                    phaseMovesLeft = (phaseMovesLeft > 0) ?
                        phaseMovesLeft : 0
                    let phaseMovesElapsed = (
                        (hclk.elapsedPeriodMoves > phaseMoves) ?
                        phaseMoves : hclk.elapsedPeriodMoves)

                    let periodMoves = (dispCountElapsedPeriodMoves ?
                            phaseMovesElapsed :
                            phaseMovesLeft)
                    timeStr += helper.padStart(
                        String(periodMoves), fixedPeriodMovesWidth, ' ') + '  '
                }

                let mainTime = dispCountElapsedMainTime ?
                    hclk.elapsedMainTime :
                    mainTimeLeft

                fixedWidth -= helper.strlen(timeStr)

                timeStr += helper.timeToString(mainTime,
                    fixedWidth,
                    dispFormatMainTimeFSNumDigits,
                    onLastMainNumSecs)
            } else if (displayDelay) {
                if (dispInfoNumPeriods) {
                    let periods = dispCountElapsedNumPeriods ?
                        (hclk.elapsedNumPeriods + 1) :
                        (numPhasesLeft - 1)

                    timeStr += '(' + helper.padStart(
                        String(periods), fixedNumPeriodsWidth, ' ') + ') '
                }
                if (dispInfoPeriodMoves) {
                    let phaseMovesLeft = (phaseMoves -
                        hclk.elapsedPeriodMoves)
                    phaseMovesLeft = (phaseMovesLeft > 0) ?
                        phaseMovesLeft : 0
                    let phaseMovesElapsed = (
                        (hclk.elapsedPeriodMoves > phaseMoves) ?
                        phaseMoves : hclk.elapsedPeriodMoves)

                    let periodMoves = (dispCountElapsedPeriodMoves ?
                            phaseMovesElapsed :
                            phaseMovesLeft)
                    timeStr += helper.padStart(
                        String(periodMoves), fixedPeriodMovesWidth, ' ') + '  '
                }

                let mainTime = dispCountElapsedMainTime ?
                    hclk.elapsedMainTime :
                    mainTimeLeft

                if (!hasInfiniteMainTimeLeft) {
                    if (hasPositiveInitPeriodTime) {
                        let periodTime = dispCountElapsedPeriodTime ?
                            hclk.elapsedPeriodTime :
                            periodTimeLeft

                        timeStr += helper.timeToString(periodTime,
                            fixedPeriodWidth,
                            dispFormatPeriodTimeFSNumDigits,
                            onLastPeriodNumSecs) + ' + '
                    }
                }

                fixedWidth -= helper.strlen(timeStr)

                timeStr += helper.timeToString(mainTime,
                    fixedWidth,
                    dispFormatMainTimeFSNumDigits,
                    onLastMainNumSecs)
            } else {
                // clock modes absolutePerPlayer, hourglass, word
                fixedWidth -= helper.strlen(timeStr)

                let mainTime = dispCountElapsedMainTime ?
                    hclk.elapsedMainTime :
                    mainTimeLeft

                timeStr += helper.timeToString(mainTime,
                    fixedWidth,
                    dispFormatMainTimeFSNumDigits,
                    onLastMainNumSecs)
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

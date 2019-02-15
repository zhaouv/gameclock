const {createElement: h, Component} = require('preact')
const classnames = require('classnames')

const helper = require('./helper.js')

class playerclock extends Component {
    constructor(props) {
        super(props)

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

        // hybridInternalClock keeps track of the elaspsed time and clock state
        this.hybridInternalClock = {
            elapsedMainTime: null,
            elapsedNumPeriods: null,
            elapsedPeriodMoves: null,
            elapsedPeriodTime: null,
            elapsedTotalTime: null,
            resetPeriod: null,
            state: 'preinit'
        }
        this.addElapsedHybridIC = this.addElapsedHybridIC.bind(this)
        this.adjHybridIC = this.adjHybridIC.bind(this)
        this.getHybridIC = this.getHybridIC.bind(this)

        // glue between hybridInternalClock (internal state) and tick methods
        this.expireTimer = this.expireTimer.bind(this)
        this.initTimer = this.initTimer.bind(this)
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
        this.handleInit = this.handleInit.bind(this)
        this.handleMadeMove = this.handleMadeMove.bind(this)
        this.handlePaused = this.handlePaused.bind(this)
        this.handlePlayerClockExpired = this.handlePlayerClockExpired.bind(this)
        this.handleReset = this.handleReset.bind(this)
        this.handleResumed = this.handleResumed.bind(this)

        this.timeoutID = null
        this.intervalID = null
        this.cancelDispUpdate = false
    }

    adjIC({action = null} = {}) {
        let clk = this.internalClock
        if (action === 'update') {
            if (clk.state === 'running') {
                clk.timeOnIntervalStart = clk.timeOnIntervalEnd
                clk.timeOnIntervalEnd = helper.timeNow()
                return true
            }
        } else if (action === 'pause') {
            if (clk.state === 'running') {
                clk.timeOnPause = helper.timeNow()
                clk.timeOnIntervalEnd = clk.timeOnPause
                clk.state = 'paused'
                return true
            }
        } else if (action === 'resume') {
            if (clk.state === 'paused') {
                clk.timeOnResume = helper.timeNow()
                clk.timeOnIntervalStart = clk.timeOnResume
                clk.timeOnIntervalEnd = clk.timeOnResume
                clk.state = 'running'
                return true
            } else if (clk.state === 'init') {
                clk.timeOnStart = helper.timeNow()
                clk.timeOnIntervalStart = clk.timeOnStart
                clk.timeOnIntervalEnd = clk.timeOnStart
                clk.state = 'running'
                return true
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
                return true
            }
        } else if (action === 'init') {
            clk.timeOnReset = null
            clk.timeOnPause = null
            clk.timeOnResume = null
            clk.timeOnIntervalStart = null
            clk.timeOnIntervalEnd = null
            clk.timeOnStart = null
            clk.state = 'init'
            return true
        }
        return false
    }

    getRangeIC({reftime = null} = {}) {
        let clk = this.internalClock
        if (reftime === 'start') {
            if (clk.state === 'running' || clk.state === 'paused') {
                return (helper.timeNow() - clk.timeOnStart)
            } else {
                return null
            }
        } else if (reftime === 'pause') {
            if (clk.state === 'paused') {
                return (helper.timeNow() - clk.timeOnPause)
            } else {
                return null
            }
        } else if (reftime === 'resume') {
            if (clk.state === 'running' && clk.timeOnResume != null) {
                return (helper.timeNow() - clk.timeOnResume)
            } else {
                return null
            }
        } else if (reftime === 'interval') {
            if (clk.state === 'paused' || clk.state === 'running') {
                return (clk.timeOnIntervalEnd - clk.timeOnIntervalStart)
            } else {
                return null
            }
        }
    }

    addElapsedHybridIC({elapsed = null, madeMove = false} = {}) {
        // add time, update time, and...
        // check if time expired on: pausing, updating, or adding moves
        if (elapsed == null) {
            return
        }
        let hclk = this.hybridInternalClock
        let initTime = this.props.initialTime
        let clockMode = this.props.clockMode

        let expired = false

        // add exact time used to elapsedTotalTime ...
        // can use it to calculate how much time player took to move
        // elapsedTotalTime is actual time taken, not zero when period not used in byo-yomi

        let initMainTime = initTime.mainTime
        let initPeriodTime = initTime.periodTime

        if (clockMode == 'absolutePerPlayer') {
            if ((hclk.elapsedMainTime + elapsed) >= initMainTime) {
                // will use up main time
                expired = true
                hclk.elapsedMainTime = initMainTime
                // force total to be exactly equal
                hclk.elapsedTotalTime = initMainTime
            } else {
                // will not use up main time
                hclk.elapsedTotalTime += elapsed
                hclk.elapsedMainTime += elapsed
            }
        } else if (clockMode == 'byo-yomi') {
            let elapsedremainder
            let mainTimeLeft
            if (hclk.elapsedMainTime >= initMainTime) {
                // already used up main time
                elapsedremainder = elapsed
                mainTimeLeft = false
            } else if ((hclk.elapsedMainTime + elapsed) >= initMainTime) {
                // will use up main time
                hclk.elapsedTotalTime += initMainTime - hclk.elapsedMainTime
                elapsedremainder = hclk.elapsedMainTime + elapsed - initMainTime
                mainTimeLeft = false
                hclk.elapsedMainTime = initMainTime
            } else {
                // will not use up main time
                hclk.elapsedTotalTime += elapsed
                elapsedremainder = 0
                mainTimeLeft = true
                hclk.elapsedMainTime += elapsed
            }
            if (!mainTimeLeft) {
                let periodsRemain = initTime.numPeriods - hclk.elapsedNumPeriods
                if (madeMove) {
                    hclk.elapsedPeriodMoves++
                }
                while (periodsRemain > 1 &&
                    (hclk.elapsedPeriodTime + elapsedremainder >= initPeriodTime)) {
                    // count periods used up
                    hclk.elapsedTotalTime += initPeriodTime - hclk.elapsedPeriodTime
                    elapsedremainder -= initPeriodTime - hclk.elapsedPeriodTime
                    hclk.elapsedPeriodTime = 0
                    hclk.elapsedPeriodMoves = 0
                    hclk.elapsedNumPeriods++
                    periodsRemain = initTime.numPeriods - hclk.elapsedNumPeriods
                }
                if (hclk.elapsedPeriodTime === initPeriodTime) {
                    // time expired already
                    expired = true
                } else if (hclk.elapsedPeriodTime + elapsedremainder >= initPeriodTime) {
                    hclk.elapsedTotalTime += initPeriodTime - hclk.elapsedPeriodTime
                    hclk.elapsedPeriodTime = initPeriodTime
                    expired = true
                } else {
                    // don't add time when we just reset the period,
                    // and waiting for clock to stop/resume
                    if (!(hclk.resetPeriod === true)) {
                        hclk.elapsedTotalTime += elapsedremainder
                        hclk.elapsedPeriodTime += elapsedremainder
                    }
                    // its possible to have multiple very fast moves,
                    // faster than a chance to update the hclk, so use >=
                    if (hclk.elapsedPeriodMoves >= initTime.periodMoves) {
                        // reset period clock information
                        hclk.elapsedPeriodTime = 0
                        hclk.elapsedPeriodMoves = 0
                        hclk.resetPeriod = true
                    }
                }
            }
        }
        return expired
    }

    adjHybridIC({action = null} = {}) {
        let hclk = this.hybridInternalClock
        if (action === 'madeMove') {
            if (hclk.state === 'running') {
                // must use updateTimer prior to madeMove
                let expired = this.addElapsedHybridIC({elapsed: 0, madeMove: true})
                if (expired) {
                    hclk.state = 'expired'
                    this.expireTimer()
                }
                // client must check state whether move was valid or not
                return true

            }
        } else if (action === 'update') {
            // update time & check if expired
            if (hclk.state === 'running') {
                if (this.adjIC({action: 'update'})) {
                    let interval = this.getRangeIC({reftime: 'interval'})
                    if (interval != null) {
                        let expired = this.addElapsedHybridIC({elapsed: interval})
                        hclk.resetPeriod = false
                        if (expired) {
                            hclk.state = 'expired'
                            this.expireTimer()
                        }
                        return true
                    }
                }
            }
        } else if (action === 'pause') {
            if (hclk.state === 'running') {
                if (this.adjIC({action: 'pause'})) {
                    let interval = this.getRangeIC({reftime: 'interval'})
                    if (interval != null) {
                        let expired = this.addElapsedHybridIC({elapsed: interval})
                        hclk.resetPeriod = false
                        if (expired) {
                            hclk.state = 'expired'
                            this.expireTimer()
                        } else {
                            hclk.state = 'paused'
                        }
                        return true
                    }
                }
            }
        } else if (action === 'resume') {
            if (hclk.state === 'paused' || hclk.state === 'init') {
                if (this.adjIC({action: 'resume'})) {
                    hclk.state = 'running'
                    return true
                }
            }
        } else if (action === 'reset') {
            if (hclk.state !== 'preinit') {
                this.adjIC({action: 'reset'})
                hclk.elapsedTotalTime = 0
                hclk.elapsedMainTime = 0
                hclk.elapsedNumPeriods = 0
                hclk.elapsedPeriodTime = 0
                hclk.elapsedPeriodMoves = 0
                hclk.resetPeriod = false
                hclk.state = 'init'
                return true
            }
        } else if (action === 'init') {
            if (this.adjIC({action: 'init'})) {
                hclk.elapsedTotalTime = 0
                hclk.elapsedMainTime = 0
                hclk.elapsedNumPeriods = 0
                hclk.elapsedPeriodTime = 0
                hclk.elapsedPeriodMoves = 0
                hclk.resetPeriod = false
                hclk.state = 'init'
                return true
            }
        }
        return false
    }

    getHybridIC() {
        // deep copy for hybridIC
        return {
            state: this.hybridInternalClock.state,
            elapsedTotalTime: this.hybridInternalClock.elapsedTotalTime,
            elapsedMainTime: this.hybridInternalClock.elapsedMainTime,
            elapsedNumPeriods: this.hybridInternalClock.elapsedNumPeriods,
            elapsedPeriodTime: this.hybridInternalClock.elapsedPeriodTime,
            elapsedPeriodMoves: this.hybridInternalClock.elapsedPeriodMoves
        }
    }

    expireTimer() {
        // only used from adjHybridIC
        this.stopTick()
        this.updateTimer({forced: true})
        this.handlePlayerClockExpired()
        return true
    }

    initTimer() {
        if (!this.props.clockMode || !this.props.initialTime) {
            return false
        }
        if (this.adjHybridIC({action: 'init'})) {
            this.updateTimer({forced: true})
            this.handleInit()
            if (this.props.clockActive) {
                this.resumeTimer()
            }
            return true
        } else {
            return false
        }
    }

    madeMoveTimer() {
        // first, check that time has not expired
        this.updateTimer()
        if (this.adjHybridIC({action: 'madeMove'})) {
            this.pauseTimer()
            this.handleMadeMove()
        } else {
            this.pauseTimer()
        }
    }

    pauseTimer() {
        this.updateTimer()
        if (this.adjHybridIC({action: 'pause'})) {
            this.stopTick()
            this.updateTimer()
            this.handlePaused()
            return true
        } else {
            this.updateTimer()
            return false
        }
    }

    resetTimer() {
        // pause timer first to stop stick
        this.pauseTimer()
        if (this.adjHybridIC({action: 'reset'})) {
            this.updateTimer({forced: true})
            this.handleReset()
            return true
        } else {
            return false
        }
    }

    resumeTimer() {
        if (this.adjHybridIC({action: 'resume'})) {
            this.startTick()
            this.updateTimer()
            this.handleResumed()
            return true
        } else {
            this.updateTimer()
            return false
        }
    }

    updateTimer({forced = false} = {}) {
        if (this.hybridInternalClock.state !== 'preinit') {
            if (this.adjHybridIC({action: 'update'}) || forced) {
                this.setState({
                    hybridClock: this.getHybridIC()
                })
                return true
            }
        }
        return false
    }

    calcTimeUntilNextWholeSecond() {
        let hclk = this.hybridInternalClock
        if (hclk.state !== 'running') {
            return helper.secToMilli(1)
        }

        let clockMode = this.props.clockMode
        let clk = this.internalClock
        let initTime = this.props.initialTime
        let intervalEnd = clk.timeOnIntervalEnd

        let timeUntilNextSecond = 1
        let timeNow = helper.timeNow()

        if (clockMode == 'absolutePerPlayer') {
            let elapsedAtLastInterval = hclk.elapsedMainTime
            let timeSinceLastInterval = timeNow - intervalEnd
            let realElapsed = elapsedAtLastInterval + timeSinceLastInterval
            if (hclk.elapsedMainTime < initTime.mainTime) {
                if (this.props.dispFormatMainTimeFSNumDigits > 0) {
                    let updateInterval = this.props.dispFormatMainTimeFSUpdateInterval
                    if (updateInterval > 0) {
                        let lastNumSecs = this.props.dispFormatMainTimeFSLastNumSecs
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
        } else if (clockMode == 'byo-yomi') {
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
            if (onMainTime && this.props.dispFormatMainTimeFSNumDigits > 0) {
                let updateInterval = this.props.dispFormatMainTimeFSUpdateInterval
                if (updateInterval > 0) {
                    let lastNumSecs = this.props.dispFormatMainTimeFSLastNumSecs
                    if (!(lastNumSecs > 0)) {
                        lastNumSecs = Infinity
                    }
                    if ((initTime.mainTime - realElapsed) <= lastNumSecs) {
                        // update at steps of updateInterval
                        let fs = realElapsed - Math.floor(realElapsed)
                        timeUntilNextSecond = updateInterval - (fs % updateInterval)
                    }
                }
            } else if (!onMainTime && this.props.dispFormatPeriodTimeFSNumDigits > 0) {
                let updateInterval = this.props.dispFormatPeriodTimeFSUpdateInterval
                if (updateInterval > 0) {
                    let lastNumSecs = this.props.dispFormatPeriodTimeFSLastNumSecs
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

    startTick() {
        this.cancelDispUpdate = false
        this.intervalID = requestAnimationFrame(this.tick)
    }

    stopTick() {
        this.cancelDispUpdate = true
        cancelAnimationFrame(this.intervalID)
        clearTimeout(this.timeoutID)
    }

    tick() {
        if (this.cancelDispUpdate) return
        this.updateTimer()
        this.timeoutID = setTimeout(() => {
            this.intervalID = requestAnimationFrame(this.tick)
        }, this.calcTimeUntilNextWholeSecond())
    }

    handleInit() {
        if (this.props.handleInit != null) {
            this.props.handleInit({
                clock: this.state.hybridClock,
                playerID: this.props.initialTime.playerID
            })
        }
    }

    handleMadeMove() {
        if (this.props.handleMadeMove != null) {
            this.props.handleMadeMove({
                clock: this.state.hybridClock,
                playerID: this.props.initialTime.playerID
            })
        }
    }

    handlePaused() {
        if (this.props.handlePaused != null) {
            this.props.handlePaused({
                clock: this.state.hybridClock,
                playerID: this.props.initialTime.playerID
            })
        }
    }

    handlePlayerClockExpired() {
        if (this.props.handlePlayerClockExpired != null) {
            this.props.handlePlayerClockExpired({
                clock: this.state.hybridClock,
                playerID: this.props.initialTime.playerID
            })
        }
    }

    handleReset() {
        if (this.props.handleReset != null) {
            this.props.handleReset({
                clock: this.state.hybridClock,
                playerID: this.props.initialTime.playerID
            })
        }
    }

    handleResumed() {
        if (this.props.handleResumed != null) {
            this.props.handleResumed({
                clock: this.state.hybridClock,
                playerID: this.props.initialTime.playerID
            })
        }
    }

    componentDidMount() {
        this.initTimer()
        this.props.handleUpdated()
    }

    componentWillUnmount() {
        this.stopTick()
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
            handleInit,
            handleMadeMove,
            handlePaused,
            handlePlayerClockExpired,
            handleReset,
            handleResumed,
            numMoves
        } = this.props

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
        if (handleInit !== nextProps.handleInit) return true
        if (handleMadeMove !== nextProps.handleMadeMove) return true
        if (handlePaused !== nextProps.handlePaused) return true
        if (handlePlayerClockExpired !== nextProps.handlePlayerClockExpired) return true
        if (handleReset !== nextProps.handleReset) return true
        if (handleResumed !== nextProps.handleResumed) return true

        if (initialTime !== nextProps.initialTime) return true
        if (initialTime != null && nextProps.initialTime != null &&
            !helper.shallowEquals(initialTime, nextProps.initialTime)) {
                return true
        }

        if (numMoves !== nextProps.numMoves) return true

        return false
    }

    componentDidUpdate(prevProps) {
        this.props.handleUpdated()

        if (this.props.numMoves != prevProps.numMoves &&
            this.props.numMoves > prevProps.numMoves) {
            // update timer to reflect new move (pausing the timer)
            this.madeMoveTimer()
        }
        if (this.props.doReset !== prevProps.doReset &&
            this.props.doReset === true &&
            this.props.handleReset != null &&
            this.props.initialTime != null) {

            this.resetTimer()
        }

        if (this.props.initialTime != null &&
            (
                this.props.initialTime.mainTime !== prevProps.initialTime.mainTime ||
                this.props.initialTime.numPeriods !== prevProps.initialTime.numPeriods ||
                this.props.initialTime.periodMoves !== prevProps.initialTime.periodMoves ||
                this.props.initialTime.periodTime !== prevProps.initialTime.periodTime
            )) {
            // do init on change of initial Time
            // first pause to stop clock tick
            this.pauseTimer()
            this.initTimer()
        }

        if (this.props.clockActive !== prevProps.clockActive) {
            if (this.props.clockActive === false) {
                if (prevProps.clockActive) {
                    // pausing from (possible) manual gameclock pause
                    this.pauseTimer()
                }
            } else if (this.props.clockActive === true) {
                if (!this.resumeTimer()) {
                    // if could not resume, try init
                    this.initTimer()
                }
            }
        }
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
            numMoves
        } = this.props

        let hybridClockHasState = hybridClock != null &&
                hybridClock.state != null
        let hasInitTime = initialTime != null
        let hasTimerInit = hasInitTime && hybridClockHasState
        let mainTimeLeft = hasTimerInit ?
                initialTime.mainTime - hybridClock.elapsedMainTime : 0
        let hasMainTimeLeft = mainTimeLeft > 0
        let hasExpired = hasTimerInit &&
                hybridClock.state === 'expired'
        let hasNotExpired = hasTimerInit &&
                hybridClock.state !== 'expired'

        let isInactive = !clockActive && hybridClockHasState && (
                hybridClock.state === 'preinit' ||
                hybridClock.state === 'init' ||
                hybridClock.state === 'reset')
        let isPaused = hasTimerInit && hybridClockHasState &&
                (!clockActive && (
                    hybridClock.state === 'running' ||
                    hybridClock.state === 'paused'
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

        //let fixedWidthCh = (fixedWidth != null && fixedWidth > 0) ? fixedWidth + 'ch' : null

        let timeStr = ''
        if (dispInfoPlayerText) {
            timeStr += initialTime.playerText + ' '
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
                    'playerclock_' + gameClockID + '_' + initialTime.playerID,
                    !hasNotExpired ? 'expired' : '',
                    !hasInfiniteTimeLeft && clockActive ? 'running' : '',
                    hasInfiniteTimeLeft && clockActive ? 'infinitetime' : '',
                    isPaused ? 'paused' : '',
                    isInactive ? 'inactive' : ''
                ),
                id: 'playerclock_' + gameClockID + '_' + initialTime.playerID
            },
            timeStr
        )
    }
}

module.exports = playerclock

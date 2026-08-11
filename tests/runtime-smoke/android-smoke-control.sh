#!/system/bin/sh

set -eu

ROOT=/data/local/tmp/newsilly-gate
NODE=/data/local/tmp/newsilly-node24180/libnode.so
PID_FILE="$ROOT/smoke.pid"
LOG_FILE="$ROOT/smoke.log"

is_running() {
    [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

start() {
    if is_running; then
        echo "ALREADY_RUNNING $(cat "$PID_FILE")"
        return 10
    fi

    rm -f "$PID_FILE" "$LOG_FILE"
    mkdir -p "$ROOT/data"
    cd "$ROOT"
    SMOKE_DATA_ROOT="$ROOT/data" SMOKE_PORT=8124 \
        nohup "$NODE" smoke-server.mjs >"$LOG_FILE" 2>&1 </dev/null &
    pid=$!
    echo "$pid" >"$PID_FILE"
    echo "STARTED $pid"
}

stop() {
    if ! is_running; then
        rm -f "$PID_FILE"
        echo "NOT_RUNNING"
        return 0
    fi

    pid=$(cat "$PID_FILE")
    kill -TERM "$pid"
    attempts=0
    while kill -0 "$pid" 2>/dev/null; do
        attempts=$((attempts + 1))
        if [ "$attempts" -ge 50 ]; then
            kill -KILL "$pid" 2>/dev/null || true
            rm -f "$PID_FILE"
            echo "FORCE_STOPPED $pid"
            return 1
        fi
        sleep 0.1
    done

    rm -f "$PID_FILE"
    echo "STOPPED $pid"
}

status() {
    if is_running; then
        echo "RUNNING $(cat "$PID_FILE")"
    else
        echo "STOPPED"
        return 1
    fi
}

case "${1:-}" in
    start) start ;;
    stop) stop ;;
    status) status ;;
    *) echo "Usage: $0 {start|stop|status}" >&2; exit 2 ;;
esac

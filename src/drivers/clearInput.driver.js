
export function makeClearInputDriver() {
    function ClearInputDriver(elem$) {
      elem$.addListener({
        next(elem) { elem.value = '' },
        error(err) { console.error(err) },
        complete() {}
      })
    }
    return ClearInputDriver
}
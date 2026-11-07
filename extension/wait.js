// Çeviri gelene kadar videoyu geçici duraklatma mantığı.
(() => {
  const ns = (globalThis.YTR = globalThis.YTR || {});

  ns.createWaitController = ({ getVideo, isEnabled, getProgress, onWaitingChange }) => {
    let autoPaused = false;
    let wePaused = false;
    let wePlayed = false;
    let timer = 0;
    let pausedCue = null;
    let attachedVideo = null;

    const notify = (val) => {
      if (onWaitingChange) {
        try { onWaitingChange(val); } catch (_) {}
      }
    };

    const onPause = () => {
      if (wePaused) {
        wePaused = false;
      } else {
        // Kullanıcı kendisi duraklattı
        clearTimeout(timer);
        timer = 0;
        autoPaused = false;
        notify(false);
      }
    };

    const onPlay = () => {
      if (wePlayed) {
        wePlayed = false;
      } else {
        // Kullanıcı kendisi oynattı
        clearTimeout(timer);
        timer = 0;
        autoPaused = false;
        notify(false);
      }
    };

    const attach = (v) => {
      if (attachedVideo === v) return;
      if (attachedVideo) {
        attachedVideo.removeEventListener('pause', onPause);
        attachedVideo.removeEventListener('play', onPlay);
      }
      attachedVideo = v;
      if (v) {
        v.addEventListener('pause', onPause);
        v.addEventListener('play', onPlay);
      }
    };

    const resume = () => {
      clearTimeout(timer);
      timer = 0;
      if (!autoPaused) return;
      autoPaused = false;
      const v = getVideo ? getVideo() : null;
      if (v && v.paused) {
        wePlayed = true;
        v.play().catch(() => {});
      }
      notify(false);
    };

    const check = (cue) => {
      const v = getVideo ? getVideo() : null;
      attach(v);

      if (!isEnabled() || !cue || cue.tr) {
        if (autoPaused && cue && cue.tr) resume();
        return { waiting: false };
      }

      if (autoPaused) return { waiting: true };

      // Aynı cue için yalnızca bir kez duraklat
      if (pausedCue === cue) return { waiting: false };

      const prog = getProgress ? getProgress() : null;
      if (!prog || !prog.active || prog.failed > 0) return { waiting: false };

      // Çeviri bekleniyor: duraklat
      autoPaused = true;
      pausedCue = cue;
      wePaused = true;
      if (v && !v.paused) v.pause();

      clearTimeout(timer);
      timer = setTimeout(resume, 10000);
      notify(true);
      return { waiting: true };
    };

    const onChunkDone = () => {
      if (autoPaused && pausedCue && pausedCue.tr) {
        resume();
      }
    };

    const reset = () => {
      clearTimeout(timer);
      timer = 0;
      autoPaused = false;
      wePaused = false;
      wePlayed = false;
      pausedCue = null;
      notify(false);
    };

    return {
      check,
      onChunkDone,
      resume,
      reset,
      isWaiting: () => autoPaused,
    };
  };
})();

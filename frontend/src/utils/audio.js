let audioContext = null;

const getAudioContext = () => {
  if (!audioContext) {
    const AudioContext =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContext) {
      return null;
    }

    audioContext = new AudioContext();
  }

  return audioContext;
};

const playTone = ({
  frequency = 700,
  duration = 0.12,
  volume = 0.04,
  type = "sine",
} = {}) => {

  const context =
    getAudioContext();

  if (!context) {
    return;
  }

  if (context.state === "suspended") {
    context.resume();
  }

  const oscillator =
    context.createOscillator();

  const gain =
    context.createGain();

  oscillator.type = type;

  oscillator.frequency.setValueAtTime(
    frequency,
    context.currentTime
  );

  gain.gain.setValueAtTime(
    0.0001,
    context.currentTime
  );

  gain.gain.exponentialRampToValueAtTime(
    volume,
    context.currentTime + 0.01
  );

  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    context.currentTime + duration
  );

  oscillator.connect(gain);
  gain.connect(context.destination);

  oscillator.start();

  oscillator.stop(
    context.currentTime + duration + 0.02
  );
};

/*
|--------------------------------------------------------------------------
| Normal notification
|--------------------------------------------------------------------------
*/

export const playNotificationSound = () => {
  playTone({
    frequency: 720,
    duration: 0.12,
    volume: 0.035,
  });

  setTimeout(() => {
    playTone({
      frequency: 900,
      duration: 0.14,
      volume: 0.03,
    });
  }, 100);
};

/*
|--------------------------------------------------------------------------
| Wildlife threat alert
|--------------------------------------------------------------------------
*/

export const playThreatAlert = () => {

  playTone({
    frequency: 520,
    duration: 0.18,
    volume: 0.06,
    type: "square",
  });

  setTimeout(() => {
    playTone({
      frequency: 390,
      duration: 0.18,
      volume: 0.06,
      type: "square",
    });
  }, 200);

  setTimeout(() => {
    playTone({
      frequency: 520,
      duration: 0.18,
      volume: 0.06,
      type: "square",
    });
  }, 400);
};

/*
|--------------------------------------------------------------------------
| SMS notification
|--------------------------------------------------------------------------
*/

export const playSmsSound = () => {
  playTone({
    frequency: 850,
    duration: 0.1,
    volume: 0.04,
  });

  setTimeout(() => {
    playTone({
      frequency: 1050,
      duration: 0.1,
      volume: 0.035,
    });
  }, 110);
};

/*
|--------------------------------------------------------------------------
| Camera connected
|--------------------------------------------------------------------------
*/

export const playCameraConnectedSound = () => {
  playTone({
    frequency: 600,
    duration: 0.1,
    volume: 0.035,
  });

  setTimeout(() => {
    playTone({
      frequency: 800,
      duration: 0.14,
      volume: 0.035,
    });
  }, 100);
};

/*
|--------------------------------------------------------------------------
| Camera disconnected
|--------------------------------------------------------------------------
*/

export const playCameraDisconnectedSound = () => {
  playTone({
    frequency: 500,
    duration: 0.15,
    volume: 0.04,
  });

  setTimeout(() => {
    playTone({
      frequency: 300,
      duration: 0.18,
      volume: 0.04,
    });
  }, 130);
};

/*
|--------------------------------------------------------------------------
| Export default
|--------------------------------------------------------------------------
*/

const audio = {
  playNotificationSound,
  playThreatAlert,
  playSmsSound,
  playCameraConnectedSound,
  playCameraDisconnectedSound,
};

export default audio;
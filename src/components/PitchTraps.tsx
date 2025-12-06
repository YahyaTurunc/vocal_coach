import React from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

// Bu HTML, tarayıcının ses motorunu kullanarak pitch tespiti yapar
const htmlContent = `
<html>
<body>
<script>
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let analyser;
let mic;
let javascriptNode;

async function start() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    mic = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    mic.connect(analyser);
    
    const bufferLength = analyser.fftSize;
    const buffer = new Float32Array(bufferLength);
    
    setInterval(() => {
      analyser.getFloatTimeDomainData(buffer);
      const pitch = autoCorrelate(buffer, audioContext.sampleRate);
      if (pitch !== -1) {
        window.ReactNativeWebView.postMessage(pitch.toString());
      }
    }, 50); // Saniyede 20 kez güncelle
  } catch (e) {
    window.ReactNativeWebView.postMessage("ERROR: " + e.message);
  }
}

// Basit Autocorrelation Algoritması (Sesi notaya çevirir)
function autoCorrelate(buf, sampleRate) {
  letSIZE = buf.length;
  let rms = 0;
  for (let i = 0; i < letSIZE; i++) {
    const val = buf[i];
    rms += val * val;
  }
  rms = Math.sqrt(rms / letSIZE);
  if (rms < 0.01) return -1; // Ses çok düşükse yoksay

  let r1 = 0, r2 = letSIZE - 1, thres = 0.2;
  for (let i = 0; i < letSIZE / 2; i++) {
    if (Math.abs(buf[i]) < thres) { r1 = i; break; }
  }
  for (let i = 1; i < letSIZE / 2; i++) {
    if (Math.abs(buf[letSIZE - i]) < thres) { r2 = letSIZE - i; break; }
  }

  buf = buf.slice(r1, r2);
  letSIZE = buf.length;

  let c = new Array(letSIZE).fill(0);
  for (let i = 0; i < letSIZE; i++) {
    for (let j = 0; j < letSIZE - i; j++) {
      c[i] = c[i] + buf[j] * buf[j + i];
    }
  }

  let d = 0; while (c[d] > c[d + 1]) d++;
  let maxval = -1, maxpos = -1;
  for (let i = d; i < letSIZE; i++) {
    if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
  }
  let T0 = maxpos;

  return sampleRate / T0;
}

start();
</script>
</body>
</html>
`;

export default function PitchTraps({ onPitchDetected }: { onPitchDetected: (freq: number) => void }) {
    return (
        <View style={{ height: 0, width: 0, position: 'absolute' }}>
            <WebView
                source={{ html: htmlContent }}
                javaScriptEnabled={true}
                onMessage={(event) => {
                    const data = event.nativeEvent.data;
                    if (data && !isNaN(data)) {
                        onPitchDetected(parseFloat(data));
                    }
                }}
                mediaPlaybackRequiresUserAction={false}
            />
        </View>
    );
}
import React from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

const htmlContent = `
<html>
<body>
<script>
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let analyser;
let mic;

async function start() {
  try {
    // Mikrofon izni iste
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
    }, 50); 

  } catch (e) {
    window.ReactNativeWebView.postMessage("ERROR: " + e.message);
  }
}

function autoCorrelate(buf, sampleRate) {
  let SIZE = buf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) {
    const val = buf[i];
    rms += val * val;
  }
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1;

  let r1 = 0, r2 = SIZE - 1, thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buf[i]) < thres) { r1 = i; break; }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }
  }

  buf = buf.slice(r1, r2);
  SIZE = buf.length;

  let c = new Array(SIZE).fill(0);
  for (let i = 0; i < SIZE; i++) {
    for (let j = 0; j < SIZE - i; j++) {
      c[i] = c[i] + buf[j] * buf[j + i];
    }
  }

  let d = 0; while (c[d] > c[d + 1]) d++;
  let maxval = -1, maxpos = -1;
  for (let i = d; i < SIZE; i++) {
    if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
  }
  let T0 = maxpos;

  return sampleRate / T0;
}

setTimeout(start, 500);
</script>
</body>
</html>
`;

export default function PitchTraps({ onPitchDetected }: { onPitchDetected: (freq: number) => void }) {
    return (
        <View style={{ height: 0, width: 0, position: 'absolute' }}>
            <WebView
                // ÖNEMLİ: baseUrl ekledik. Bu sayede iOS bunu 'güvenli' sayar.
                source={{ html: htmlContent, baseUrl: 'https://localhost/' }}
                originWhitelist={['*']}
                javaScriptEnabled={true}
                allowsInlineMediaPlayback={true} // iOS için kritik
                mediaPlaybackRequiresUserAction={false}
                onMessage={(event) => {
                    const data = event.nativeEvent.data;
                    if (data.startsWith("ERROR")) {
                        console.error("PitchTraps Error:", data);
                        return;
                    }
                    const pitch = parseFloat(data);
                    if (!isNaN(pitch)) {
                        onPitchDetected(pitch);
                    }
                }}
            />
        </View>
    );
}
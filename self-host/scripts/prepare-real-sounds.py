"""Extract eight short impacts from krb21's CC0 air-hockey field recording.
Source: https://freesound.org/people/krb21/sounds/118604/
Input is the public HQ MP3 preview, not the login-only original WAV.
"""
import array
import json
import pathlib
import subprocess
import wave

root = pathlib.Path(__file__).resolve().parents[1]
audio = root / 'public' / 'assets' / 'audio'
decoded = root / 'test-output' / 'air-hockey-decoded.wav'
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(audio / 'air-hockey-krb21-118604.mp3'),
                '-ac', '1', '-ar', '48000', '-af', 'highpass=f=250', '-c:a', 'pcm_s16le', str(decoded)], check=True)
with wave.open(str(decoded), 'rb') as source:
    rate = source.getframerate()
    data = array.array('h', source.readframes(source.getnframes()))
window = rate // 100
peaks = [(max(abs(v) for v in data[i:i+window]), i) for i in range(rate//3, len(data)-rate//3, window)]
selected = []
for amplitude, index in sorted(peaks, reverse=True):
    if all(abs(index-old) > rate*.65 for old in selected):
        selected.append(index)
    if len(selected) == 8:
        break
manifest = []
for number, index in enumerate(sorted(selected), 1):
    begin = max(0, index-int(rate*.012))
    clip = array.array('h', data[begin:begin+int(rate*.22)])
    gain = .82*32767/max(1, max(abs(v) for v in clip))
    for n in range(len(clip)):
        envelope = min(1, n/(rate*.002), (len(clip)-1-n)/(rate*.035))
        clip[n] = int(clip[n]*gain*max(0, envelope))
    filename = f'air-hit-{number:02d}.wav'
    with wave.open(str(audio / filename), 'wb') as target:
        target.setnchannels(1)
        target.setsampwidth(2)
        target.setframerate(rate)
        target.writeframes(clip.tobytes())
    manifest.append({'file': filename, 'startSeconds': round(begin/rate, 4), 'duration': .22})
(audio / 'real-recording-cuts.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
print(json.dumps(manifest))

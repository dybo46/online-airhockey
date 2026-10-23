"""Prepare labelled comparisons from SoundBible, BudgetPixel and the CC0 recording.
See public/assets/audio/CREDITS.md for exact attribution and licences.
"""
import array
import json
import pathlib
import subprocess
import wave

root = pathlib.Path(__file__).resolve().parents[1]
assets = root / 'public/assets/audio'
cache = root / 'test-output/audio-downloads'
records = []

def decode(source, name):
    target = cache / (name + '-decoded.wav')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(source), '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s16le', str(target)], check=True)
    with wave.open(str(target), 'rb') as f:
        return array.array('h', f.readframes(f.getnframes()))

def cut(data, filename, centre, duration=.24):
    start = max(0, centre-480)
    values = array.array('h', data[start:start+int(48000*duration)])
    gain = .8*32767/max(1, max(abs(v) for v in values))
    for i in range(len(values)):
        fade = max(0, min(1, i/48, (len(values)-1-i)/1200))
        values[i] = int(values[i]*gain*fade)
    with wave.open(str(assets / filename), 'wb') as f:
        f.setnchannels(1); f.setsampwidth(2); f.setframerate(48000); f.writeframes(values.tobytes())
    records.append({'file': filename, 'start': start/48000, 'duration': len(values)/48000})

for name in ['puck', 'stick']:
    data = decode(cache / ('source-soundbible-'+name+'.mp3'), 'soundbible-'+name)
    peak = max(range(len(data)), key=lambda i: abs(data[i]))
    cut(data, 'soundbible-'+name+'.wav', peak, .34)
data = decode(cache / 'source-budgetpixel-air.wav', 'budgetpixel')
peaks = sorted(range(0, len(data)-9600, 240), key=lambda i: max(abs(v) for v in data[i:i+240]), reverse=True)
chosen=[]
for peak in peaks:
    if all(abs(peak-p)>.45*48000 for p in chosen): chosen.append(peak)
    if len(chosen)==2: break
for i, peak in enumerate(chosen, 1): cut(data, f'budgetpixel-air-{i:02d}.wav', peak)
data = decode(assets / 'air-hockey-krb21-118604.mp3', 'air-original')
cuts = json.loads((assets/'real-recording-cuts.json').read_text())
for i, info in enumerate(cuts[:4], 1): cut(data, f'air-dry-{i:02d}.wav', int((info['startSeconds']+.012)*48000), .16)
(assets/'comparison-cuts.json').write_text(json.dumps(records, indent=2), encoding='utf-8')
print(json.dumps(records))

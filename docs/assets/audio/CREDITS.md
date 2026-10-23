# Sound effects

## v0.5 comparisons from additional sites (S37–S46)

- **S37 — Hockey Puck Slap**, by **jameb32**, SoundBible: https://soundbible.com/1556-Hockey-Puck-Slap.html
- **S38 — Hockey Stick Slap 2**, by **jameb32**, SoundBible: https://soundbible.com/1747-Hockey-Stick-Slap-2.html
  - License: **Creative Commons Attribution 3.0**, https://creativecommons.org/licenses/by/3.0/
  - These are hockey-stick/puck impacts, not recordings of an air-hockey table. Clearly labelled as ice-hockey comparisons in the selector.
  - Source MP3 URLs: https://soundbible.com/mp3/Hockey%20Puck%20Slap-SoundBible.com-318266142.mp3 and https://soundbible.com/mp3/Hockey%20Stick%20Slap%202-SoundBible.com-166536715.mp3
  - Modified: trimmed around a transient to 0.34 seconds, mono 48kHz conversion, peak-level adjustment and fade. Files: soundbible-puck.wav, soundbible-stick.wav.
- **S39–S40, S45–S46 — “Air Hockey Rally Goal” by BudgetPixel AI**, https://budgetpixel.com/sfx/air-hockey-rally-goal-5c34c893 — **CC BY 4.0**, https://creativecommons.org/licenses/by/4.0/
  - Source: https://cdn.budgetpixel.com/audio-library/sfx/bouncy-crisp-clunky-impactful-fast-kzoc7s.wav
  - This source is **AI-generated**, described by its publisher as a rally followed by a goal clunk. It is not a field recording. Labels explicitly say synthetic.
  - S39–S40: two 0.24-second transient excerpts, peak normalization and fade.
  - S45: goal-clunk-a.wav, excerpt beginning at 2.58s, up to 0.42s long with short fades. S46: goal-clunk-b.wav, pitch lowered to 82% for a deeper comparison.
- **S41–S44** — four original-pitch excerpts from krb21's CC0 recording below, without the v0.4 high-pass filter. Shortened to 0.16 seconds, normalized and faded. Files: air-dry-01.wav through air-dry-04.wav. Same source attribution and CC0 licence as S29–S36.

Exact cut positions: comparison-cuts.json. Reproduction: scripts/prepare-comparison-sounds.py. These changes do not imply the original authors endorse this game. The sources retain their own CC0/CC BY licences; the entire library must not be described as CC0.

Additional sites checked but not used: Sound-Fishing's air-hockey goal recordings and Pro Sound Effects' goal recordings require payment. No paid previews or unlicensed soundboard clips were copied into the game.

## Real air hockey recording (S29–S36, default impacts)

- Author: krb21. Title: air hockey smack.WAV (2011-04-22).
- Original source and CC0 declaration: https://freesound.org/people/krb21/sounds/118604/
- Public HQ preview used: https://cdn.freesound.org/previews/118/118604_1269383-hq.mp3
- License: Creative Commons Zero (CC0), https://creativecommons.org/publicdomain/zero/1.0/
- The source describes an actual air hockey game with puck/paddle and wall impacts. It is a single recording, not eight separate field recordings. air-hit-01.wav through air-hit-08.wav are eight different 0.22-second excerpts, high-pass filtered to reduce table hum, peak-normalized and faded. Exact positions are in real-recording-cuts.json. Preparation script: scripts/prepare-real-sounds.py.
- The original full-resolution WAV requires a Freesound login; we used the publicly served HQ MP3 preview. No login or account was used.

## Other candidates (S01–S28)

Downloaded from the original Kenney asset pages on 2026-10-22. Only selected audio and the original License.txt files are distributed in this game. License: Creative Commons Zero (CC0). Attribution is included voluntarily.

- Kenney — Impact Sounds 1.0: https://kenney.nl/assets/impact-sounds
  - impactWood_light_000/001/002.ogg (paddle hit / COOL)
  - impactMetal_light_000/001.ogg (wall bounce)
  - Original license: License-impact.txt
- Kenney — Digital Audio: https://kenney.nl/assets/digital-audio
  - laser1/2.ogg (DRIVE / serve)
  - powerUp1/2.ogg (SMASH)
  - Original license: License-digital.txt
- Kenney — Music Jingles: https://kenney.nl/assets/music-jingles
  - Audio/Hit jingles/jingles_HIT00/01.ogg (goal)
  - Audio/8-Bit jingles/jingles_NES02.ogg (win)
  - Original license: License-jingles.txt

License reference: https://creativecommons.org/publicdomain/zero/1.0/
The original sound files are unmodified. Playback rate and volume can vary during gameplay. Files are served locally; the game does not contact Kenney or any audio host during play.

Additional unused candidates from the same Kenney packs are included for audition: impactMetal_light_002/003, impactWood_medium_000/001, impactWood_heavy_000, impactPlate_light_000; laser3/4/5/6, powerUp3/4, highUp/highDown; jingles_HIT02 and jingles_NES03. Stable IDs and labels are in public/audio.js. Default playback uses original pitch; volume varies by event.

/**
 * VoiceRecorderWidget - Tablet-First Audio Recording & Transcription
 * 
 * Provides cross-platform speech recording (iPadOS Safari & Windows Chrome),
 * upload to /api/audio/recordings, faster-whisper transcription insertion,
 * and audio attachment state management.
 * Designed for 1-to-1 reusability in ECM2M.
 */

(function (window) {
  'use strict';

  // Determine optimal MIME type supported by browser
  function getSupportedMimeType() {
    if (typeof MediaRecorder === 'undefined') return '';
    const candidates = [
      'audio/mp4;codecs=aac',
      'audio/mp4',
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus'
    ];
    for (const mime of candidates) {
      if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(mime)) {
        return mime;
      }
    }
    return '';
  }

  function formatTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  class VoiceRecorderWidget {
    constructor(options = {}) {
      this.buttonContainer = options.buttonContainer || null;
      this.bannerContainer = options.bannerContainer || null;
      this.previewContainer = options.previewContainer || null;
      this.textarea = options.textarea || null;
      this.onComplete = options.onComplete || null;
      this.onError = options.onError || null;

      this.mediaRecorder = null;
      this.audioStream = null;
      this.audioChunks = [];
      this.recordingTimer = null;
      this.secondsElapsed = 0;
      this.mimeType = getSupportedMimeType();

      this.attachedAudio = null; // { audio_file_id, audio_duration, transcript }

      this._initUI();
    }

    _initUI() {
      if (!this.buttonContainer) return;

      this.recordBtn = document.createElement('button');
      this.recordBtn.type = 'button';
      this.recordBtn.className = 'voice-record-btn';
      this.recordBtn.setAttribute('aria-label', 'Start spraakopname');
      this.recordBtn.setAttribute('title', 'Spraakopname starten (inspreken)');
      this.recordBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 24px;">mic</span>';

      this.recordBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleRecording();
      });

      this.buttonContainer.innerHTML = '';
      this.buttonContainer.appendChild(this.recordBtn);
    }

    async toggleRecording() {
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.stopRecording();
      } else {
        await this.startRecording();
      }
    }

    async startRecording() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const msg = 'Microfoontoegang wordt niet ondersteund door deze browser.';
        if (this.onError) this.onError(msg);
        else alert(msg);
        return;
      }

      try {
        this.audioChunks = [];
        this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        const recorderOptions = this.mimeType ? { mimeType: this.mimeType } : {};
        this.mediaRecorder = new MediaRecorder(this.audioStream, recorderOptions);

        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            this.audioChunks.push(event.data);
          }
        };

        this.mediaRecorder.onstop = () => {
          this._handleRecordingStopped();
        };

        this.mediaRecorder.start(250); // Slice chunks every 250ms
        this.secondsElapsed = 0;
        this.recordBtn.classList.add('recording');
        this.recordBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 24px;">stop</span>';
        this.recordBtn.setAttribute('title', 'Opname stoppen en transcriberen');

        this._showRecordingBanner();
        this.recordingTimer = setInterval(() => {
          this.secondsElapsed += 1;
          this._updateTimerDisplay();
        }, 1000);

      } catch (err) {
        console.error('Fout bij starten audio-opname:', err);
        const msg = err.name === 'NotAllowedError' 
          ? 'Microfoontoegang geweigerd. Geef toestemming in browserinstellingen.'
          : `Kan microfoon niet openen: ${err.message}`;
        if (this.onError) this.onError(msg);
        else alert(msg);
      }
    }

    stopRecording() {
      if (this.recordingTimer) {
        clearInterval(this.recordingTimer);
        this.recordingTimer = null;
      }

      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
      }

      if (this.audioStream) {
        this.audioStream.getTracks().forEach((track) => track.stop());
        this.audioStream = null;
      }

      this.recordBtn.classList.remove('recording');
      this.recordBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 24px;">mic</span>';
      this.recordBtn.setAttribute('title', 'Spraakopname starten (inspreken)');
    }

    cancelRecording() {
      this.audioChunks = [];
      this.stopRecording();
      this._hideRecordingBanner();
    }

    _showRecordingBanner() {
      if (!this.bannerContainer) return;
      this.bannerContainer.style.display = 'block';
      this.bannerContainer.innerHTML = `
        <div class="voice-recording-banner">
          <div class="voice-recording-banner__indicator">
            <div class="voice-recording-banner__dot"></div>
            <span>Opname actief...</span>
            <span class="voice-recording-banner__timer" id="voice-timer-display">0:00</span>
          </div>
          <div class="voice-recording-banner__actions">
            <button type="button" class="voice-recording-action-btn" id="voice-btn-cancel" title="Opname annuleren">
              <span class="material-symbols-outlined" style="font-size: 20px;">close</span>
            </button>
            <button type="button" class="voice-recording-action-btn" id="voice-btn-stop" title="Opname voltooien">
              <span class="material-symbols-outlined" style="font-size: 20px;">check</span>
            </button>
          </div>
        </div>
      `;

      const cancelBtn = this.bannerContainer.querySelector('#voice-btn-cancel');
      if (cancelBtn) cancelBtn.addEventListener('click', () => this.cancelRecording());

      const stopBtn = this.bannerContainer.querySelector('#voice-btn-stop');
      if (stopBtn) stopBtn.addEventListener('click', () => this.stopRecording());
    }

    _updateTimerDisplay() {
      if (!this.bannerContainer) return;
      const display = this.bannerContainer.querySelector('#voice-timer-display');
      if (display) {
        display.textContent = formatTime(this.secondsElapsed);
      }
    }

    _hideRecordingBanner() {
      if (!this.bannerContainer) return;
      this.bannerContainer.style.display = 'none';
      this.bannerContainer.innerHTML = '';
    }

    async _handleRecordingStopped() {
      if (!this.audioChunks || this.audioChunks.length === 0) {
        this._hideRecordingBanner();
        return;
      }

      // Show processing status
      if (this.bannerContainer) {
        this.bannerContainer.innerHTML = `
          <div class="voice-recording-banner" style="background-color: var(--md-sys-color-surface-container-highest, #E6E0E9); color: var(--md-sys-color-on-surface, #1D1B20);">
            <div class="voice-recording-banner__indicator">
              <span class="material-symbols-outlined spin" style="font-size: 18px;">sync</span>
              <span>Audio verwerken en transcriberen...</span>
            </div>
          </div>
        `;
      }

      const mimeType = this.mimeType || (this.audioChunks[0] ? this.audioChunks[0].type : 'audio/webm');
      const ext = mimeType.includes('mp4') ? 'mp4' : (mimeType.includes('ogg') ? 'ogg' : 'webm');
      const audioBlob = new Blob(this.audioChunks, { type: mimeType });

      const formData = new FormData();
      formData.append('file', audioBlob, `recording.${ext}`);

      try {
        const token = localStorage.getItem('token') || (window.Auth && window.Auth.getToken ? window.Auth.getToken() : '');
        const headers = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch('/api/audio/recordings', {
          method: 'POST',
          headers: headers,
          body: formData
        });

        if (!response.ok) {
          let errDetail = 'Fout bij uploaden audio';
          try {
            const errData = await response.json();
            if (errData.detail) errDetail = errData.detail;
          } catch (_) {}
          throw new Error(errDetail);
        }

        const result = await response.json();
        // result = { audio_file_id, audio_duration, transcript, status }

        this.attachedAudio = {
          audio_file_id: result.audio_file_id,
          audio_duration: result.audio_duration,
          transcript: result.transcript
        };

        // Auto-fill textarea if present and transcript available
        if (this.textarea && result.transcript) {
          const currentVal = this.textarea.value.trim();
          if (currentVal) {
            this.textarea.value = `${currentVal} ${result.transcript}`.trim();
          } else {
            this.textarea.value = result.transcript.trim();
          }
          this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }

        this._hideRecordingBanner();
        this._showAudioPreviewBadge(result);

        if (this.onComplete) {
          this.onComplete(this.attachedAudio);
        }

      } catch (err) {
        console.error('Fout bij audio upload/transcriptie:', err);
        this._hideRecordingBanner();
        const msg = `Audio transcriptie mislukt: ${err.message}`;
        if (this.onError) this.onError(msg);
        else alert(msg);
      }
    }

    _showAudioPreviewBadge(audioData) {
      if (!this.previewContainer) return;
      this.previewContainer.style.display = 'block';
      this.previewContainer.innerHTML = `
        <div class="voice-attached-badge">
          <span class="material-symbols-outlined" style="font-size: 16px;">mic</span>
          <span>Audio gekoppeld (${formatTime(audioData.audio_duration)})</span>
          <button type="button" class="voice-attached-badge__remove" title="Audio verwijderen">
            <span class="material-symbols-outlined" style="font-size: 14px;">close</span>
          </button>
        </div>
      `;

      const removeBtn = this.previewContainer.querySelector('.voice-attached-badge__remove');
      if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.clearAttachment();
        });
      }
    }

    clearAttachment() {
      this.attachedAudio = null;
      if (this.previewContainer) {
        this.previewContainer.style.display = 'none';
        this.previewContainer.innerHTML = '';
      }
    }

    getAttachedAudio() {
      return this.attachedAudio;
    }
  }

  // Export globally for browser application and ECM2M
  window.VoiceRecorderWidget = VoiceRecorderWidget;

})(typeof window !== 'undefined' ? window : this);

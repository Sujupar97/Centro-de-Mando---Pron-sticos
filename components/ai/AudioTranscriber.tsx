import React, { useState, useRef, useEffect, useCallback } from 'react';
// FIX: Se elimina la importación de `LiveSession` ya que no es un miembro exportado del módulo '@google/genai'.
import { Modality, Blob } from '@google/genai';
// FIX: Se importa la instancia `ai` directamente en lugar de la función inexistente `getGoogleGenAI`.
import { ai } from '../../services/geminiService';
import { MicrophoneIcon } from '../icons/Icons';

// Funciones de codificación de audio (no usar librerías externas)
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}


export const AudioTranscriber: React.FC = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [transcription, setTranscription] = useState('');
    const [error, setError] = useState('');
    
    // FIX: Se infiere el tipo de la promesa de sesión directamente desde la función `ai.live.connect`
    // para evitar el uso del tipo no exportado `LiveSession`.
    const sessionRef = useRef<ReturnType<typeof ai.live.connect> | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);

    const stopRecording = useCallback(() => {
        if (sessionRef.current) {
            sessionRef.current.then(session => session.close());
            sessionRef.current = null;
        }
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        setIsRecording(false);
    }, []);

    useEffect(() => {
        // Limpieza al desmontar el componente
        return () => {
            stopRecording();
        };
    }, [stopRecording]);

    const startRecording = async () => {
        setError('');
        setTranscription('');
        setIsRecording(true);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;
            
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            
            // FIX: Se usa la instancia `ai` importada directamente.
            sessionRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => console.log('Conexión de transcripción abierta.'),
                    onmessage: (message) => {
                        if (message.serverContent?.inputTranscription) {
                            const text = message.serverContent.inputTranscription.text;
                            setTranscription(prev => prev + text);
                        }
                    },
                    onerror: (e) => {
                        console.error('Error en la sesión de Live API:', e);
                        setError('Ocurrió un error de conexión con el servicio de transcripción.');
                        stopRecording();
                    },
                    onclose: () => {
                        console.log('Conexión de transcripción cerrada.');
                    },
                },
                config: {
                    inputAudioTranscription: {},
                    responseModalities: [Modality.AUDIO],
                }
            });

            const source = audioContextRef.current.createMediaStreamSource(stream);
            const scriptProcessor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                const pcmBlob = createBlob(inputData);
                if (sessionRef.current) {
                    sessionRef.current.then((session) => {
                        session.sendRealtimeInput({ media: pcmBlob });
                    });
                }
            };
            
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextRef.current.destination);

        } catch (err) {
            console.error('Error al iniciar la grabación:', err);
            setError('No se pudo acceder al micrófono. Asegúrate de haber dado permiso.');
            setIsRecording(false);
        }
    };

    return (
        <div className="flex flex-col space-y-4 h-full">
            <h3 className="text-xl font-semibold text-white">Transcripción de Audio en Tiempo Real</h3>
            <p className="text-sm text-gray-400">
                Haz clic en el botón para comenzar a grabar. Tu voz se transcribirá en tiempo real usando Gemini. Vuelve a hacer clic para detener.
            </p>
            <div className="flex justify-center items-center my-4">
                <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`flex items-center justify-center w-20 h-20 rounded-full transition-colors duration-300 ${isRecording ? 'bg-red-accent hover:bg-red-500' : 'bg-green-accent hover:bg-green-600'}`}
                    aria-label={isRecording ? 'Detener grabación' : 'Iniciar grabación'}
                >
                    <MicrophoneIcon className="w-8 h-8 text-white" />
                </button>
            </div>
            
            {error && <div className="bg-red-500/20 text-red-accent p-3 rounded-md text-center">{error}</div>}

            <div className="flex-grow bg-gray-900 rounded-lg p-4 min-h-[150px] overflow-y-auto">
                <p className="text-white whitespace-pre-wrap">{transcription || 'La transcripción aparecerá aquí...'}</p>
            </div>
        </div>
    );
};
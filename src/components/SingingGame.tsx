import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Audio } from 'expo-av';
import { PitchDetector } from '../utils/PitchDetector';
import { frequencyToMidi, midiToNoteName, getNoteAtTime, SongMap } from '../utils/AudioUtils';
import vocalMap from '../../assets/song_data/islak_islak/vocal_map.json';

const { width } = Dimensions.get('window');

export default function SingingGame() {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentNote, setCurrentNote] = useState<string>('-');
    const [targetNote, setTargetNote] = useState<string>('-');
    const [targetMidi, setTargetMidi] = useState<number | null>(null);
    const [feedbackColor, setFeedbackColor] = useState<string>('#808080'); // Gray
    const [score, setScore] = useState(0);

    const soundRef = useRef<Audio.Sound | null>(null);
    const pitchDetectorRef = useRef<PitchDetector | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    useEffect(() => {
        pitchDetectorRef.current = new PitchDetector();
        return () => {
            stopGame();
        };
    }, []);

    const startGame = async () => {
        try {
            // Load Audio
            const { sound } = await Audio.Sound.createAsync(
                // In a real app, require the local file. 
                // For this demo, we assume the file exists or we catch the error.
                // require('../../assets/song_data/islak_islak/backing_track.mp3')
                // Using a dummy silent file or just proceeding without sound if missing would be safer for the code to run without crashing.
                // But the user asked for the code structure.
                // I will use a placeholder URI that works (e.g. a short beep or silence) or comment out.
                // For now, I'll assume the user will provide the file.
                require('../../assets/song_data/islak_islak/backing_track.mp3')
                // { uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' } // Placeholder URL
            );
            soundRef.current = sound;
            await sound.playAsync();

            // Start Pitch Detection
            await pitchDetectorRef.current?.start((pitch) => {
                const userMidi = frequencyToMidi(pitch);
                const userNoteName = midiToNoteName(userMidi);
                setCurrentNote(userNoteName);

                // We need to compare with target in the loop, but we can also store the latest pitch here.
                // Actually, the loop handles the comparison based on time.
                // We'll store the userMidi in a ref to access it in the loop?
                // Or just update state and let the loop read state? 
                // State updates are async, so ref is better for the loop.
                userMidiRef.current = userMidi;
            });

            setIsPlaying(true);
            gameLoop();
        } catch (error) {
            console.error("Error starting game:", error);
        }
    };

    const userMidiRef = useRef<number>(0);

    const stopGame = async () => {
        setIsPlaying(false);
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        if (soundRef.current) {
            await soundRef.current.unloadAsync();
            soundRef.current = null;
        }
        await pitchDetectorRef.current?.stop();
    };

    const gameLoop = async () => {
        if (!soundRef.current) return;

        const status = await soundRef.current.getStatusAsync();
        if (!status.isLoaded) return;

        const currentTime = status.positionMillis / 1000; // seconds

        // User logic:s
        // @ts-ignore
        const currentNote = vocalMap.tracks[0].notes.find((note: any) => {
            return currentTime >= note.time && currentTime <= (note.time + note.duration);
        });

        if (currentNote) {
            setTargetNote(currentNote.name);
            setTargetMidi(currentNote.midi);

            const userMidi = userMidiRef.current;
            // Compare
            if (userMidi > 0) {
                const diff = Math.abs(userMidi - currentNote.midi);
                if (diff <= 1) {
                    setFeedbackColor('#4CAF50'); // Green
                    setScore(s => s + 1);
                } else {
                    setFeedbackColor('#F44336'); // Red
                }
            } else {
                setFeedbackColor('#808080'); // Gray (Silence)
            }
        } else {
            setTargetNote('-');
            setTargetMidi(null);
            setFeedbackColor('#808080');
        }

        if (status.isPlaying) {
            animationFrameRef.current = requestAnimationFrame(gameLoop);
        } else {
            setIsPlaying(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Singing Teacher</Text>
            <Text style={styles.songName}>Islak Islak</Text>

            <View style={[styles.feedbackCircle, { backgroundColor: feedbackColor }]}>
                <Text style={styles.noteText}>{currentNote}</Text>
                <Text style={styles.label}>You</Text>
            </View>

            <View style={styles.targetContainer}>
                <Text style={styles.label}>Target</Text>
                <Text style={styles.targetNote}>{targetNote}</Text>
            </View>

            <Text style={styles.score}>Score: {score}</Text>

            <TouchableOpacity
                style={styles.button}
                onPress={isPlaying ? stopGame : startGame}
            >
                <Text style={styles.buttonText}>
                    {isPlaying ? 'Stop' : 'Start Singing'}
                </Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    title: {
        fontSize: 24,
        color: '#fff',
        marginBottom: 10,
        fontWeight: 'bold',
    },
    songName: {
        fontSize: 18,
        color: '#aaa',
        marginBottom: 40,
    },
    feedbackCircle: {
        width: 150,
        height: 150,
        borderRadius: 75,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 30,
        borderWidth: 2,
        borderColor: '#fff',
    },
    noteText: {
        fontSize: 48,
        color: '#fff',
        fontWeight: 'bold',
    },
    targetContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    targetNote: {
        fontSize: 36,
        color: '#FFD700', // Gold
        fontWeight: 'bold',
    },
    label: {
        fontSize: 14,
        color: '#ccc',
        marginTop: 5,
    },
    score: {
        fontSize: 20,
        color: '#fff',
        marginBottom: 30,
    },
    button: {
        backgroundColor: '#2196F3',
        paddingHorizontal: 40,
        paddingVertical: 15,
        borderRadius: 30,
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});

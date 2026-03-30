import { useEffect, useState } from 'react';
import { Linking, SafeAreaView, StyleSheet, useColorScheme } from 'react-native';
import { MainScreen } from './src/screens/MainScreen';

export default function App() {
  const [quickCaptureToken, setQuickCaptureToken] = useState(0);
  const isDarkMode = useColorScheme() === 'dark';

  useEffect(() => {
    const handleUrl = (url: string | null) => {
      if (!url) {
        return;
      }

      if (url.includes('echo://record') || url.includes('echo://capture')) {
        setQuickCaptureToken(prev => prev + 1);
      }
    };

    Linking.getInitialURL()
      .then(handleUrl)
      .catch(error => {
        console.error('Initial URL handling error:', error);
      });

    const subscription = Linking.addEventListener('url', event => {
      handleUrl(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <SafeAreaView style={[styles.container, isDarkMode && styles.containerDark]}>
      <MainScreen quickCaptureToken={quickCaptureToken} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  containerDark: {
    backgroundColor: '#15181b',
  },
});

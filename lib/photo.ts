// 사진 첨부 — 시스템 PHPicker는 '갤러리 안 촬영 탭'이 없으므로 액션시트 2지선다
// (촬영/갤러리)로 합류시킨다. 고른 사진 uri를 콜백으로 전달하고, 취소 시 호출하지 않는다.
import * as ImagePicker from 'expo-image-picker';
import { ActionSheetIOS, Alert, Platform } from 'react-native';

const OPTS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true, // 정사각 크롭(썸네일에 맞춤)
  quality: 0.7,
};

async function fromCamera(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('카메라 권한 필요', '설정에서 카메라 접근을 허용해 주세요.');
    return null;
  }
  const res = await ImagePicker.launchCameraAsync(OPTS);
  return res.canceled ? null : res.assets[0].uri;
}

async function fromLibrary(): Promise<string | null> {
  const res = await ImagePicker.launchImageLibraryAsync(OPTS);
  return res.canceled ? null : res.assets[0].uri;
}

export function pickPhoto(onPicked: (uri: string) => void) {
  const run = async (which: 'camera' | 'library') => {
    const uri = which === 'camera' ? await fromCamera() : await fromLibrary();
    if (uri) onPicked(uri);
  };
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['취소', '사진 촬영', '갤러리에서 선택'], cancelButtonIndex: 0 },
      (i) => {
        if (i === 1) run('camera');
        else if (i === 2) run('library');
      }
    );
  } else {
    Alert.alert('사진 추가', undefined, [
      { text: '사진 촬영', onPress: () => run('camera') },
      { text: '갤러리에서 선택', onPress: () => run('library') },
      { text: '취소', style: 'cancel' },
    ]);
  }
}

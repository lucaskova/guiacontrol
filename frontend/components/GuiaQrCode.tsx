import React from 'react';
import { View, StyleSheet } from 'react-native';
import QRCode from 'react-qr-code';

export type GuiaQrCodeProps = {
  value: string;
  size?: number;
  color?: string;
  backgroundColor?: string;
};

/**
 * QR em todas as plataformas via react-qr-code (qr.js + SVG).
 * Evita react-native-qrcode-svg → qrcode → pngjs → util.inherits no web.
 */
export function GuiaQrCode({
  value,
  size = 180,
  color = '#111827',
  backgroundColor = '#FFFFFF',
}: GuiaQrCodeProps) {
  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <QRCode
        value={value}
        size={size}
        fgColor={color}
        bgColor={backgroundColor}
        level="M"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

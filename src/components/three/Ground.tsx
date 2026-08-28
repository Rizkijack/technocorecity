'use client'

export function Ground({ size = 200 }: { size?: number }) {
  return (
    <>
      {/* eslint-disable-next-line react/no-unknown-property */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow={false}>
        {/* eslint-disable-next-line react/no-unknown-property */}
        <planeGeometry args={[size, size]} />
        {/* eslint-disable-next-line react/no-unknown-property */}
        <meshStandardMaterial color="#0f1535" roughness={0.8} />
      </mesh>
      {/* subtle spatial reference grid — #2a3160 on both axes */}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <gridHelper args={[size, 50, '#2a3160', '#1c2347']} position={[0, 0.01, 0]} />
    </>
  )
}

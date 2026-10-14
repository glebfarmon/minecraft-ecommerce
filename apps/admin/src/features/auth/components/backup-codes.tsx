export function BackupCodes({codes}: {codes: string[]}) {
  return (
    <ul className="grid grid-cols-2 gap-2 font-mono text-sm" data-testid="backup-codes">
      {codes.map(code => (
        <li key={code}>{code}</li>
      ))}
    </ul>
  )
}

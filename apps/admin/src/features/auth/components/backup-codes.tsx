export function BackupCodes({codes}: {codes: string[]}) {
  return (
    <ul
      className="grid grid-cols-2 gap-2 font-mono text-[13px] [&>li]:rounded-plate [&>li]:bg-card-raised [&>li]:px-3 [&>li]:py-2 [&>li]:text-center"
      data-testid="backup-codes">
      {codes.map(code => (
        <li key={code}>{code}</li>
      ))}
    </ul>
  )
}

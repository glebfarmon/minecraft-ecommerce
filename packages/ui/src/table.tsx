import type * as React from 'react'

import {cn} from './lib/utils'

function Table({className, ...props}: React.ComponentProps<'table'>) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        data-slot="table"
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  )
}

function TableHeader(props: React.ComponentProps<'thead'>) {
  return <thead data-slot="table-header" {...props} />
}

function TableBody(props: React.ComponentProps<'tbody'>) {
  return <tbody data-slot="table-body" {...props} />
}

function TableRow({className, ...props}: React.ComponentProps<'tr'>) {
  return <tr data-slot="table-row" className={cn('border-b border-line', className)} {...props} />
}

function TableHead({className, ...props}: React.ComponentProps<'th'>) {
  return (
    <th
      data-slot="table-head"
      className={cn('label-caps h-10 px-3 text-left align-middle', className)}
      {...props}
    />
  )
}

function TableCell({className, ...props}: React.ComponentProps<'td'>) {
  return (
    <td
      data-slot="table-cell"
      className={cn('px-3 py-2.5 align-middle text-[13px]', className)}
      {...props}
    />
  )
}

export {Table, TableBody, TableCell, TableHead, TableHeader, TableRow}

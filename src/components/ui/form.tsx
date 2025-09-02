import React from 'react'

export interface FormFieldProps {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}

export function FormField({ label, required = false, error, children }: FormFieldProps) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {error && (
        <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
      )}
    </div>
  )
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export function Input({ className = '', error, ...props }: InputProps) {
  return (
    <input
      className={`
        w-full h-9 rounded-md border border-input bg-background px-3 text-sm
        focus:outline-none focus:ring-2 focus:ring-primary/40
        disabled:opacity-50 disabled:cursor-not-allowed
        ${error ? 'border-red-500 focus:ring-red-500/40' : ''}
        ${className}
      `}
      {...props}
    />
  )
}

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

export function Textarea({ className = '', error, ...props }: TextareaProps) {
  return (
    <textarea
      className={`
        w-full rounded-md border border-input bg-background px-3 py-2 text-sm
        focus:outline-none focus:ring-2 focus:ring-primary/40
        disabled:opacity-50 disabled:cursor-not-allowed resize-vertical
        ${error ? 'border-red-500 focus:ring-red-500/40' : ''}
        ${className}
      `}
      {...props}
    />
  )
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
}

export function Select({ className = '', error, children, ...props }: SelectProps) {
  return (
    <select
      className={`
        w-full h-9 rounded-md border border-input bg-background px-3 text-sm
        focus:outline-none focus:ring-2 focus:ring-primary/40
        disabled:opacity-50 disabled:cursor-not-allowed
        ${error ? 'border-red-500 focus:ring-red-500/40' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </select>
  )
}

export function Checkbox({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={`
        h-4 w-4 rounded border border-input text-primary 
        focus:ring-2 focus:ring-primary/40
        ${className}
      `}
      {...props}
    />
  )
}
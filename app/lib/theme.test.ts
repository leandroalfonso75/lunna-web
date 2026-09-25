import { describe, expect, it } from 'vitest'
import {
  DEFAULT_THEME_MODE,
  THEME_MODES,
  THEME_STORAGE_KEY,
  isThemeMode,
  resolveTheme,
  themeAntiFlashScript,
  themeDataAttr
} from './theme'

describe('THEME_MODES / DEFAULT_THEME_MODE', () => {
  it('os três modos existem', () => {
    expect(THEME_MODES).toEqual(['claro', 'escuro', 'sistema'])
  })

  it('o padrão é claro', () => {
    expect(DEFAULT_THEME_MODE).toBe('claro')
  })
})

describe('isThemeMode', () => {
  it('aceita os três modos válidos', () => {
    expect(isThemeMode('claro')).toBe(true)
    expect(isThemeMode('escuro')).toBe(true)
    expect(isThemeMode('sistema')).toBe(true)
  })

  it('rejeita qualquer outra coisa', () => {
    expect(isThemeMode('dark')).toBe(false)
    expect(isThemeMode(null)).toBe(false)
    expect(isThemeMode(undefined)).toBe(false)
    expect(isThemeMode(1)).toBe(false)
  })
})

describe('resolveTheme', () => {
  it('claro/escuro são diretos, sem olhar o sistema', () => {
    expect(resolveTheme('claro', true)).toBe('claro')
    expect(resolveTheme('escuro', false)).toBe('escuro')
  })

  it('sistema segue o prefers-color-scheme', () => {
    expect(resolveTheme('sistema', true)).toBe('escuro')
    expect(resolveTheme('sistema', false)).toBe('claro')
  })
})

describe('themeDataAttr', () => {
  it('mapeia para o atributo data-theme', () => {
    expect(themeDataAttr('claro')).toBe('light')
    expect(themeDataAttr('escuro')).toBe('dark')
  })
})

describe('themeAntiFlashScript', () => {
  it('lê a mesma chave de storage usada pelo resto do módulo', () => {
    expect(themeAntiFlashScript()).toContain(THEME_STORAGE_KEY)
  })

  it('é a mesma string em toda chamada (para app.test.ts comparar por igualdade)', () => {
    expect(themeAntiFlashScript()).toBe(themeAntiFlashScript())
  })

  it('está envolto em try/catch (localStorage pode estourar em modo privado)', () => {
    expect(themeAntiFlashScript()).toContain('try{')
    expect(themeAntiFlashScript()).toContain('catch(e){}')
  })
})

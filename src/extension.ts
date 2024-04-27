import * as vscode from 'vscode'
import axios from 'axios'
import { parseUnknownError } from './utils'
import type { Snippet } from './types'

export function activate(context: vscode.ExtensionContext) {
  const preferences = vscode.workspace.getConfiguration('masscode-assistant')
  const baseUrl = preferences.get('baseUrl')
  const search = vscode.commands.registerCommand(
    'masscode-assistant.search',
    async () => {
      try {
        const { data } = await axios.get<Snippet[]>(
          `${baseUrl}/snippets/embed-folder`
        )

        const lastSelectedId = context.globalState.get('masscode:last-selected')

        const options = data
          .filter((i) => !i.isDeleted)
          .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))
          .reduce((acc: vscode.QuickPickItem[], snippet) => {
            const fragments = snippet.content.map((fragment) => {
              const isLastSelected = lastSelectedId === snippet.id

              return {
                label: snippet.name || 'Untitled snippet',
                detail: snippet.content.length > 1 ? fragment.label : '',
                description: `${fragment.language} • ${
                  snippet.folder?.name || 'Inbox'
                }`,
                picked: isLastSelected // use picked props to determine as last selected
              }
            }) as vscode.QuickPickItem[]

            acc.push(...fragments)

            return acc
          }, []) as vscode.QuickPickItem[]

        const isExist = options.find((i) => i.picked)

        if (isExist) {
          options.sort((i) => (i.picked ? -1 : 1))
          options.unshift({
            label: 'Last selected',
            kind: -1
          })
        }

        let snippet: Snippet | undefined
        let fragmentContent = ''

        const picked = await vscode.window.showQuickPick(options, {
          placeHolder: 'Type to search...',
          onDidSelectItem(item: vscode.QuickPickItem) {
            snippet = data.find((i) => i.name === item.label)

            if (snippet) {
              if (snippet.content.length === 1) {
                fragmentContent = snippet.content[0].value
              } else {
                fragmentContent =
                  snippet.content.find((i) => i.label === item.detail)?.value ||
                  ''
              }
            } else {
              fragmentContent = ''
            }
          }
        })

        if (!picked) return

        if (fragmentContent.length) {
          vscode.env.clipboard.writeText(fragmentContent)
          vscode.commands.executeCommand('editor.action.clipboardPasteAction')
          context.globalState.update('masscode:last-selected', snippet?.id)
        }
      } catch (err) {
        vscode.window.showErrorMessage(
          'Can not search snippets from massCode app.',
          {
            detail: parseUnknownError(err).message
          }
        )
      }
    }
  )

  const create = vscode.commands.registerCommand(
    'masscode-assistant.create',
    async () => {
      vscode.commands.executeCommand('editor.action.clipboardCopyAction')

      const preferences =
        vscode.workspace.getConfiguration('masscode-assistant')
      const baseUrl = preferences.get('baseUrl')
      const isNotify = preferences.get('notify')

      const content = (await vscode.env.clipboard.readText()).trim()
      if (!content) {
        if (isNotify) {
          vscode.window.showInformationMessage(
            'Selection is empty, skipping creating snippet.'
          )
        }

        return
      }

      const name = (
        await vscode.window.showInputBox({
          prompt: 'Please input the name of snippet.'
        })
      )?.trim()
      if (!name) {
        if (isNotify) {
          vscode.window.showInformationMessage(
            'Name is empty, skipping creating snippet.'
          )
        }

        return
      }

      const body: Partial<Snippet> = {
        name,
        content: [
          {
            label: 'Fragment 1',
            value: content,
            language: 'plain_text'
          }
        ]
      }

      try {
        await axios.post(`${baseUrl}/snippets/create`, body)

        if (isNotify) {
          vscode.window.showInformationMessage('Snippet successfully created')
        }
      } catch (err) {
        vscode.window.showErrorMessage(
          'Can not create snippets to massCode app.',
          {
            detail: parseUnknownError(err).message
          }
        )
      }
    }
  )

  context.subscriptions.push(search)
  context.subscriptions.push(create)
}

export function deactivate() {}

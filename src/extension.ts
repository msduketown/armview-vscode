//
// ARM Viewer - VS Code Extension
// Ben Coleman, 2019
// Main Extension script
//

import * as vscode from 'vscode';
import * as path from 'path';
import ARMParser from './lib/arm-parser';

var panel: vscode.WebviewPanel | undefined = undefined;
var extensionPath: string;
var editor: vscode.TextEditor;

//
// Main extension activation
//
export function activate(context: vscode.ExtensionContext) {
	extensionPath = context.extensionPath

  context.subscriptions.push(
    vscode.commands.registerCommand('armView.start', () => {
			// Check for open editors that are showing JSON
			// These are safe guards, the `when` clauses in package.json should prevent this
			if(!vscode.window.activeTextEditor) {
				vscode.window.showErrorMessage("No editor active, open a ARM template JSON file in the editor")
				return;
			} else {
				if(vscode.window.activeTextEditor.document.languageId != "json") {
					vscode.window.showErrorMessage("Current file is not JSON")
					return;
				}
			}
			
			// Store the active editor at start
			editor = vscode.window.activeTextEditor

			if (panel) {
				// If we already have a panel, show it
				panel.reveal();
				return;
			} 

			// Create the panel (held globally)
      panel = vscode.window.createWebviewPanel(
        'armViewer',
        'ARM Viewer',
        vscode.ViewColumn.Beside,
				{ 
					enableScripts: true,
					localResourceRoots: [vscode.Uri.file(path.join(extensionPath, 'assets'))]
				}
			);

			// Give panel a custom icon
			panel.iconPath = { 
				dark: vscode.Uri.file(`${extensionPath}/assets/img/icons/eye-dark.svg`),
				light: vscode.Uri.file(`${extensionPath}/assets/img/icons/eye-light.svg`)
			}	
			
			// Load the webview HTML/JS
			panel.webview.html = getWebviewContent();
			
			// Listen for active document changes, i.e. user typing
			vscode.workspace.onDidChangeTextDocument(event => {
				//console.log("### onDidChangeTextDocument");
				try {
					refreshView();
				} catch(err) {}
			});

			// Listen for active editor changes
			vscode.window.onDidChangeActiveTextEditor(event => {
				//console.log("### onDidChangeActiveTextEditor");
				try {
					// Switch editor and refresh
					if(vscode.window.activeTextEditor) {
						editor = vscode.window.activeTextEditor;
						refreshView();
					}
				} catch(err) {}
			});

      // Handle messages from the webview
      panel.webview.onDidReceiveMessage(
        message => {
          if (message.command == 'initialized') {
						// Initial load of content, done at startup
						refreshView();
          }
        },
        undefined,
        context.subscriptions
			);

			// Dispose/cleanup
			panel.onDidDispose(
        () => {
					panel = undefined
				},
        null,
        context.subscriptions
      );
    })
  );
}

//
// Refresh contents of the view
//
function refreshView() {
	if(!panel)
		return

	if(editor) {
		// Skip non-JSON
		if(editor.document.languageId != "json") {
			return;
		}

		// Parse the source template JSON
		let templateJSON = editor.document.getText();
    var parser = new ARMParser(templateJSON, extensionPath);    

    // Check for errors - if it's not JSON or a valid ARM template
    if(parser.getError()) {
      panel.webview.postMessage({ command: 'error', payload: parser.getError() })
		}	else {
			// Send result as message
			panel.webview.postMessage({ command: 'refresh', payload: parser.getResult() });
		}
	} else {
		vscode.window.showErrorMessage("No editor active, open a ARM template JSON file in the editor")
	}
};

//
// Initialise the contents of the webview - called at startup
//
function getWebviewContent() {	
	if(!panel)
		return ""

	const mainScriptUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(extensionPath, 'assets', 'js', 'main.js')));
	const mainCss = panel.webview.asWebviewUri(vscode.Uri.file(path.join(extensionPath, 'assets', 'css', 'main.css')));
	const cytoscapeUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(extensionPath, 'assets', 'js', 'cytoscape.min.js')));
	const prefix = panel.webview.asWebviewUri(vscode.Uri.file(path.join(extensionPath, 'assets')));

	return `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<!--meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline'; script-src * 'unsafe-inline'; style-src * 'unsafe-inline'"-->

	<script src="${cytoscapeUri}"></script>
	<script src="${mainScriptUri}"></script>

	<link href="${mainCss}" rel="stylesheet" type="text/css">

	<title>ARM Viewer</title>
</head>
<body>
	<div id="error"></div>
	<div id="buttons">
		<button onclick="toggleLabels()">LABELS</button>
		<button onclick="cy.fit()">FIT</button>
		<button onclick="reLayout()">LAYOUT</button>
	</div>
	<div id="mainview"></div>

	<div id="infobox">
	  <div class="panel-heading" onclick="hideInfo()"><img id="infoimg" src=''/> &nbsp; Resource Details</div>
    <div class="panel-body">
      <table id="infotable">    
      </table>
    </div>
	</div>
	
	<script>	
		window.addEventListener('message', event => {
			const message = event.data;

			if(message.command == 'refresh') {
				document.getElementById('error').style.display = "none"
				document.getElementById('mainview').style.display = "block"
				document.getElementById('buttons').style.display = "block"
				displayData(message.payload);
			}

			if(message.command == 'error') {
				document.getElementById('error').innerHTML = message.payload
				document.getElementById('error').style.display = "block"
				document.getElementById('mainview').style.display = "none"
				document.getElementById('buttons').style.display = "none"
			}			
		});

		init("${prefix}")
  </script>
</body>
</html>`;
}

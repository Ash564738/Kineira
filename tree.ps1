$exclude = @(
    "node_modules",
    "__pycache__",
    ".git",
    "venv",
    ".next",
    "dist",
    "build"
)

# exact-path exclusions only
$excludePaths = @(
    ".\venv\Lib",
    ".\venv\Scripts"
)

# folders that should only show 1 child level
$shallowFolders = @(
    "MP_Data",
    "WLASL"
)

function Should-Exclude($item) {

    if ($exclude -contains $item.Name) {
        return $true
    }

    foreach ($path in $excludePaths) {
        $fullExcluded = (Resolve-Path $path -ErrorAction SilentlyContinue)

        if ($fullExcluded -and $item.FullName -eq $fullExcluded.Path) {
            return $true
        }
    }

    return $false
}

function Show-Tree {
    param (
        [string]$Path = ".",
        [string]$Indent = ""
    )

    $items = Get-ChildItem -LiteralPath $Path | Where-Object {
        -not (Should-Exclude $_)
    }

    foreach ($item in $items) {

        Write-Output "$Indent|-- $($item.Name)"

        if ($item.PSIsContainer) {

            # shallow display folders
            if ($shallowFolders -contains $item.Name) {

                $childItems = Get-ChildItem -LiteralPath $item.FullName | Where-Object {
                    -not (Should-Exclude $_)
                }

                foreach ($child in $childItems) {
                    Write-Output "$Indent    |-- $($child.Name)"
                }

                continue
            }

            Show-Tree -Path $item.FullName -Indent "$Indent    "
        }
    }
}

Show-Tree | Out-File structure.txt
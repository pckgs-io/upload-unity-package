# Upload Unity Package to pckgs.io

📦 A GitHub Action for uploading Unity packages to [pckgs.io](https://pckgs.io), a registry for private and public Unity packages.  
Use this action in your workflows to publish Unity packages directly from your repository to [pckgs.io](https://pckgs.io) automatically.

---

## What is pckgs.io?

[pckgs.io](https://pckgs.io) is a Unity package registry service that makes it easy to host, share, and version Unity packages — both publicly and privately — for individuals and teams.  

---

## Usage

Make sure your repository has a secret named **PCKGS_ACCESS_TOKEN** that contains your [pckgs.io](https://pckgs.io) access token for authentication.


Check the [detailed guide](https://pckgs.io/docs/upload-a-package-with-github-actions) for full instructions on using this action to upload packages to your pckgs.io organization.

### Example Workflow

```yaml
name: Upload Unity Package to pckgs.io

on:
  push:
    branches: [main]

jobs:
  upload:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Upload package to pckgs.io
        uses: pckgs-io/upload-package@v1
        with:
          package_folder: Assets/Package
          access_token: ${{ secrets.PCKGS_ACCESS_TOKEN }}
          is_public: true
          version: "1.0.${{ github.run_number }}"
          contributor_email: ${{ github.event.pusher.email }}
          contributor_name: ${{ github.event.pusher.name }}
          contributor_url: https://github.com/${{ github.actor }}
```

## Parameters

| Parameter          | Required | Description                                                                                     |
|--------------------|----------|-------------------------------------------------------------------------------------------------|
| **package_folder**   | Yes      | Relative path to the Unity package folder within your repository that will be compressed and uploaded.                                        |
| **access_token**     | Yes      | Access token used to authenticate with pckgs.io.                                               |
| **is_public**        | Yes      | Boolean (**true** or **false**) specifying if the package should be publicly accessible. This setting applies only when the package is created for the first time.       |
| **version**          | No       | Version of the package (e.g., **1.0.0**). If omitted, the package version must be defined in the package manifest. |
| **contributor_email**| No       | Email address of the contributor uploading the package.                                        |
| **contributor_name** | No       | Name or nickname of the contributor.                                                           |
| **contributor_url**  | No       | URL to the contributor’s profile (e.g., GitHub, personal website).                             |
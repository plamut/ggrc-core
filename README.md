gGRC-Core
=========

[![Travis status](https://travis-ci.org/google/ggrc-core.svg?branch=develop)](https://travis-ci.org/google/ggrc-core)
[![Code Climate](https://codeclimate.com/github/google/ggrc-core/badges/gpa.svg)](https://codeclimate.com/github/google/ggrc-core)

Google Governance, Risk and Compliance. Migrated from [Google](https://code.google.com/p/compliance-management/)
[Code](https://code.google.com/p/ggrc-core).

Requirements
------------

The following software is required to stand up a gGRC-Core development
environment:

|               Prerequisite               |               Description                |
|------------------------------------------|------------------------------------------|
|[VirtualBox](https://www.virtualbox.org/) | Oracle VirtualBox Virtual Machine player |
|[Vagrant](http://www.vagrantup.com/)      | Handy scriptable VM management           |
|[Ansible](http://www.ansible.com/home)    | Provisioning and deployment tool         |

Or alternatively (see Quickstart with docker)

|               Prerequisite                       |                 Description              |
|--------------------------------------------------|------------------------------------------|
|[Docker](https://www.docker.com/)                 | Container management tool                |
|[Docker compose](https://docs.docker.com/compose/)| A tool for defining multi-container apps |

Quick Start
-----------

Getting started with gGRC-Core development should be fast and easy once you
have the prerequisite software installed. Here are the steps:

* clone the repo
* cd to the project directory
* make sure your ansible installation is up-to-date i.e. version 1.9.3 or higher (if it's not in the repositories, you can
install it via pip)
* run the following:

    ```sh
    git submodule update --init
    vagrant up
    vagrant ssh
    build_compass
    build_assets
    db_migrate
    ```

If you see download errors during the `vagrant up` stage, or if any subsequent
step fails, try running `vagrant provision` (See [Provision a running Vagrant
VM](#provision-a-running-vagrant-vm) below for more).

Now you're in the VM and ready to rock. Get to work!

### Quickstart with docker

Alternative setup is using just docker. Run a vagrant-like fat docker container
named *ggrccore_dev_1* with this command (from the repo root)

    docker-compose up

Add `-d` to automatically daemonize.
To enter a running container run

    docker exec -it ggrccore_dev_1 su vagrant

And then continue just like with vagrant

    build_compass
    build_assets
    db_migrate

`docker-compose` will manage the containers for you. If you want to reuse old container use

    docker-compose --no-recreate

### Launching gGRC as Stand-alone Flask

Most development is done in a stand-alone flask. We strive to make getting up
and running as simple as possible; to that end, launching the application is
simple:

```sh
launch_ggrc
```

### Launching gGRC in Google App Engine SDK

We strive to make getting up and running as simple as possible; to that end,
launching the application in the Google App Engine SDK environment is simple:

```sh
launch_gae_ggrc
```

This requires `src/app.yaml` with settings. You can generate one for
development with:

```sh
deploy_appengine extras/deploy_settings_local.sh
```

### Accessing the Application

The application will be accessible via this URL: <http://localhost:8080/>

If you're running the Google App Engine SDK, the App Engine management console
will be avaiable via this URL: <http://localhost:8000/>

### Running Tests

Tests are your friend! Keep them running, keep them updated.

For JavaScript tests:

```sh
run_karma
```

Then open Chrome at URL: <http://localhost:9876>

For Python tests:

```sh
run_pytests
```

The script will run unit tests and integration tests.

For better usage of unit tests you can use sniffer inside the test/unit folder.
This will run the tests on each file update.

```sh
cd test/unit; sniffer
```

For Selenium tests:

First you have to manually launch the server inside you dev container.
Then you can run the selenium tests with:

```sh
docker exec -it ggrccore_selenium_1 python /selenium/src/run_selenium.py
```

Note: The tests should pass if you launch the server with a clean database.

Quickstart Breakdown
--------------------

The quickstart above gives a glimpse into the gGRC development environment.
It's worth noting where there is automation in gGRC, and where there isn't.
Often the lack of automation support for a step is intentional. Let's explore
each step in detail.

### Git Submodules in gGRC

gGRC makes use of some external tools for [Sass](http://sass-lang.com/)
templates and JavaScript form handling. In order to have the relevant
repositories checked out as Git submodules the following command must be
issued in the project directory:

```sh
git submodule init
```

The lack of automation for this step is intentional. First, it must be done in
the host operating system, not the Vagrant virtual machine. Second, performing
this step informs the new gGRC developer that there are Git submodules to be
concerned about, leading to the second step:

```sh
git submodule update
```

As the dependencies change over time it will be necessary for developers to
update to a new revision for one or more of the submodules.

### Ansible

gGRC-Core provides both a `Vagrantfile` and an Ansible playbook to make
standing up a development environment simple and repeatable thanks to the magic
of Vagrant and Ansible. Vagrant enables developers to use a consistent and
shared VM configuration to perform application testing while allowing
developers to use the source code editing environment of their choice.

### Vagrant

The application is run in a virtual machine environment that can be repeatably,
consistently, and reliably constructed thanks to Vagrant. In order to use
Vagrant to create and manage the development virtual machine environment, it
must first be created by issuing the following command from the project
directory:

```sh
vagrant up
```

This results in the creation of the virtual machine and the provisioning of
required software to support the development and execution of gGRC.

#### Reprovisioning a Vagrant VM

There are several ways to update the provisioning of a Vagrant VM when changes
have been made to the cookbooks or other dependency management mechanisms in
gGRC.

##### Provision a running Vagrant VM

To run provisioning on a running Vagrant VM, simply run the following in the
project directory:

```sh
vagrant provision
```

##### Provisioning a halted Vagrant VM

If you have halted your Vagrant VM via `vagrant halt`, simply `vagrant up`
in the project directory to have provisioning run and update your development
environment.

##### Clean Slate Provisioning

To create a clean slate environment in your Vagrant VM you can either reload or
recreate the environment. To reload the environment issue the following command
in the project directory:

```sh
vagrant reload
```

To completely recreate the environment issue the following command in the
project directory:

```sh
vagrant destroy
vagrant up
```

### Compiling Sass Templates

Since gGRC uses Sass for CSS templating, the templates need to be compiled.
This has been automated via a script available in $PATH in the virtual
machine:

```sh
build_compass
```

To have a process watch the Sass resources and compile them as they are changed
you could use this command:

```sh
watch_compass
```

### Compiling Assets

For other asset bundling required, there is the following command:

```sh
build_assets
```

As for Compass, there is an asset builder that can watch for changes and update
files as they change:

```sh
watch_assets
```

### Importing Example Data

Example test data can be loaded with the following command:

```sh
mysql -u root -p ggrcdev < backup-file.sql
```

Gotchas
-------

After sync'ing your local clone of gGRC-Core you may experience a failure when
trying to run the application due to a change (usually an addition) to the
prerequisites.

There are three primary classes of requirements for gGRC-Core: submodules,
cookbooks and Python packages. Cookbooks are managed via specification in the
`Cheffile` while Python packages are managed via specification in
[pip](https://en.wikipedia.org/wiki/Pip_(package_manager)) requirements files.

There are two pip requirements files: a runtime requirements file,
`src/requirements.txt`, for application package dependencies and a
development requirements file, `src/dev-requirements.txt`, for additional
development-time package dependencies. The runtime requirements are deployed
with the application while the development requirements are only used in the
development environment (largely for testing purposes).

Most requirements changes should be in either `src/requirements.txt` or
`src/dev-requirements.txt` and would manifest as module import failures.

### Environment Variables

*GGRC_SETTINGS_MODULE*:

GGRC uses this environment variable to define which module(s) within
`ggrc.settings` to use during the bootstrap phase. The value can be one
or more space-separated module names, which will be applied in the same
order they are specified. `source bin/init_env` will set this value to
`development`.

### Details About VM File Structure

`vagrant provision` installs several Debian packages globally within the
VM. All other project data is contained within two directories, specified by
environment variables (and defined in `/home/vagrant/.bashrc`).

*PREFIX*:

Points at root directory of the Git repository, and is automatically
detected if not present.

*DEV_PREFIX*:

Points at a directory containing `tmp` and `opt` directories. If not
defined, `DEV_PREFIX` defaults to the value of `PREFIX`. (In the VM,
it is defined to `/vagrant-dev` to avoid slowdown caused by the shared
filesystem at `/vagrant`.)

### Changes to Requirements Files

The first thing to try to resolve issues due to missing prerequisites is to
run the following command from within the project directory in the host
operating system (what you're running the VM on):

```sh
vagrant provision
```

This will prompt vagrant to run the Chef provisioner. The result of this
command *should* be an update Python virtualenv containing the Python packages
required by the application as well as any new development package
requirements. However, this may not be the case and you may experience a
provisioning failure due to a change to `Cheffile`.

Running `vagrant provision` will run the following in the VM to update the
development environment.

```sh
make
pip install -r src/dev-requirements.txt
pip install --no-deps -r src/requirements.txt
```

Note that if you're using `launch_gae_ggrc`, then changes to
`src/requirements.txt` will require rebuilding the `src/packages.zip` via
`make appengine_packages_zip`. (This is also handled by the `make` step
run via `vagrant provision`.)

### Cheffile Changes

The addition of cookbooks to the project prerequisites can lead to provisioning
failures. The solution is to update the cookbooks in the `cookbooks` directory
by issuing the following commands from within the project directory:

```sh
librarian-chef install
vagrant provision
```

### Changes to `site-cookbooks`

Changes to the recipes defined by gGRC itself can also lead to errors. The
solution is to reprovision the Vagrant VM:

```sh
vagrant provision
```

### Git Submodule Changes

A change in the git submodules required by the project could also lead to
errors, particularly in the front-end HTML portion of the application. The
solution is to update the submodules:

```sh
git submodule update
```

Given that Sass and Javascript related projects are included in the submodule
requirements of gGRC, it may also be necessary to rebuild the Sass and other
web assets:

```sh
build_compass
build_assets
```

# Copyright Notice

Copyright (C) 2013-2015 Google Inc., authors, and contributors (see the AUTHORS
file).
Licensed under the [Apache 2.0](http://www.apache.org/licenses/LICENSE-2.0)
license (see the LICENSE file).

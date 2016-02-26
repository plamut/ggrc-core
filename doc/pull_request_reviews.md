<a name="top"></a>
# A simple helper/guide for reviewing pull requests


## Table of contents

* [Quickstart](#quickstart)
* [Using GitHub labels](#using-github-labels)
* [Reviewing and merging pull requests](#reviewing-and-merging-pull-requests)
* [Setting up (and tearing down) the environment - step by step guide](
  #setting-up-and-tearing-down-the-environment---step-by-step-guide)


## Quickstart

_NOTE: Before doing anything else, if you are reviewing a bugfix pull request,
you must first reproduce the issue on the main development branch as mentioned
in the [relevant section](#reviewing-a-bugfix-pr)._

Add the following git alias to your `.gitconfig` file (e.g. the one located in
your home directory):

```ini
[alias]
    pr = "!f() { \
        git fetch -fu ${2:-<remote_main>} refs/pull/$1/head:pr/$1 && \
        git checkout pr/$1; \
    }; f"
```

In the alias `<remote_main>` stands for the name of the remote representing
the main development repository, i.e. the one the pull requests are sent to.
Such a remote is commonly named `upstream`. You need to make sure to insert
the correct name in the above alias definition.

With the alias defined, go to the project root directory and type the following
in the console:

```console
git pr <pr_number>
```

This command will automatically fetch and checkout the branch containing the
changes in the pull request `<pr_number>`, e.g. 1234.

_NOTE: The command must be run on a clean repository. If you have any pending
local changes, you first need to put them aside by running `git stash`, or
discarding them altogether._

If the pull request contains database changes (marked with the `migration`
label), you need to update the database as well before you start reviewing the
changes.

With the PR branch fetched, you need to merge it with the branch the PR was
made against, usually - but not always - `develop`, and test how the _merged_
code performs.

Whey you have everything set up, start the application and verify that
everything works as intended (see the
[relevant section](#reviewing-and-merging-pull-requests) for details). If the
pull request turns out to be good, you can merge it, provided that all the
[conditions](#merging-pull-requests) are met.

On the other hand, if there are [reasons to reject](#acceptance-criteria) a
pull request, leave the feedback in the comment(s), so that the author can
make the necessary changes.

\[[Back to top](#top)\]


## Using GitHub labels

There are several labels defined on the GitHub project repository page that can
(and should!) be used for tagging pull requests. Labeling enables easier PR
categorization and searching, thus make sure to use them.

The meaning of the lables and their intended usage is as follows (sorted
alphabetically):

* `documentation` - a PR contains the updates of project documentation,
* `in review` - somebody has already started reviewing this PR. Mainly used to
  avoid unneccessary duplicate review work. However, if the PR seems more
  complex, you are nevertheless still encouraged to start reviewing it by
  yourself as well.
  The person that added the label must make sure to remove it once done with
  the reviewing.
* `migration` - a PR contains a migration script that changes the database
  schema. Such pull requests require additional setup and verification steps,
* `needs work` - a reviewer has concluded that the PR requires additional work
  before it can be accepted and merged,
* `next release` - the PR will be merged after the current release has branched
  off of the main development branch, and should not be merged just yet,
* `please review` - the author asked that the PR should be reviewed with a
  higher pripority. This label is usually used when the PR has not received
  enough attention for a considerable time period, or because it is important
  and attempts to resolve an important/blocking issue,
* `question` - the PR author seeks advice/feedback on some code feature and/or
  design decision. It can also be used by a reviewer to ask the PR author for
  additional explanation before a decision can be made on whether the PR meets
  all the requirements.
  On top of that, this label is occasionally used when a reviewer makes a
  non-essential suggestion for a PR change, but that change is not required to
  deem the PR ready to merge,
* `wrong branch` - the author sent the PR to the wrong branch. The author
  should re-issue the same PR against the correct branch.

\[[Back to top](#top)\]


## Reviewing and merging pull requests

First of all, make sure that you have properly set up the local environment,
then follow the guidelines described in the next couple of sections.

#### Reviewing a new feature PR

The philosophy is simple - verify that the PR implements everything that is
required by the corresponding project task / specification. While reviewing, it
is highly recommended that you also test a few other application features
that might have been affected by the submitted code changes.

#### Reviewing a bugfix PR

If reviewing a pull request that contains a bug fix, you **must** first
reproduce the bug on the vanilla `develop` branch, i.e. the one without the PR
branch merged. Only after the bug has been reproduced, you can actually verify
that the PR indeed fixes something.

Again, try to also check that the bugfix has not accidentally introduced any
other issues.

#### Reviewing a PR containing database migration scripts

Pull requests that modify the database (marked with the `migration` label)
require additional checks to be performed on top of all the others regular
checks, namely the following:

* The migration works from a clean database,
* Downgrading and upgrading work on a clean database,
* Migrations work from the current database state on the main `develop` branch,
* Migrations work on a populated database (using the data from the `grc-dev`
  instance).

#### Acceptance criteria

A pull request **must be rejected** if **any** of the following is true:

* It does not do/fix what it claims to and/or it does that only partially,
* The review reveals that the PR has introduced new issues,
* At least one of the automatic checks on the continuous integration server
  fails, i.e. the build is broken,
* The new code contains severe readability, logical and/or architectural
  issues,
* The new code is not sufficiently covered with automated tests (subject to
  exceptions, e.g. when a test would be disproportionally difficult and
  time-consuiming to write, or for little UI changes like changing an icon or a
  font color).

The reviewer must mark the pull request with the `needs work` label, signalling
to the author that the PR cannot yet been merged as-is, and additional changes
are required. Along with the tagging, the reviewer should clearly explain why
the PR has temporarily been rejected, and what needs to be done before it can
be merged.

On the other hand, if the PR looks good, it can be merged immediately (subject
to the conditions described in the [next section](#merging-pull-requests)).

Sometimes, however, a PR looks good, but the reviewer is nevertheless not yet
100% confident with merging it, usually due to its complexity and/or size, or
his own lesser familiarity with the project codebase. In such cases, the
reviewer can still express the approval of the PR, but defer the final verdict
on merging to other reviewers.

An approval is given by posting a comment containing a thumb-up icon (:+1:).
For this reason, this icon icon _should not_ be used in regular comments, as it
might mislead somebody to a false conclusion.


#### Merging pull requests

A pull request can be merged only if **all** of the following is true:

* _You_ have gone through all the verification steps and concluded that
  everything works as expected (other people's approvals by themselves
  _are not enough_!),
* All automatic continuous integration checks have passed,
* The pull request does not contain **any of your commits**. You are not
  allowed to merge your own work, including the pull requests that you have at
  least partially contributed to.
* The pull request is **not** labeled with the `needs work` or the `question`
  label, meaning that all open questions and issues have been resolved.


\[[Back to top](#top)\]


## Setting up (and tearing down) the environment - step by step guide

In order to better understand how the local environment must be set up, and as
a reference, the following sections describe all the steps in more details.

_NOTE: Depending on your setup, some of the steps may be omitted. If not sure,
just run them all._

1. Make sure your local files are up to date:

    ```console
    cd to/your/ggrc/clone
    git stash  # make sure you don't have any local changes
    git fetch <remote_main>
    git checkout <remote_main>/develop
    ```

    Here `<remote_main>` stands for the name of the _remote_ representing the
    main development repository, i.e. the one the pull requests are sent to.
    Such a remote is commonly named `upstream`.

    _NOTE: If the pull request was made against a branch other than `develop`,
    you need to replace that name accordingly in the `git checkout` command.
    The rest of this section assumes that `develop` is the name of the branch
    we want to merge the new code into._


1. Test should be done on the merged branch:

    _NOTE: The merge must **not** be a fast-forward, since all pull requests
    are merged with the `--no-ff` flag._

    ```console
    git checkout -b temp_branch
    git fetch <pr_origin>
    git merge --no-ff <pr_origin>/<feature_branch_name>
    ```

    Here `<pr_origin>` stands for the name of the _remote_ the pull request
    is originating from. This is most often a fork of the `<remote_main>` by
    one of the fellow developers on the project.

    `<feature_branch_name>` must of course be replaced with the actual name of
    the remote branch containing the changes, e.g. `feature/CORE-1234`.

    If you don't yet have the `<pr_origin>` defined, you need to add it
    ([instructions](https://git-scm.com/book/en/v2/Git-Basics-Working-with-Remotes#Adding-Remote-Repositories)).

1. Start your local development environment (Vagrant or Docker). No need if you
already have it running.

    ##### If using Vagrant

    ```console
    vagrant up

    # run the following if there were any changes in the provisioning files,
    # requirements, dev-requirements, or npm requirements...
    vagrant provision

    vagrant ssh
    ```

    ##### If using Docker

    ```console
    # TODO: write Docker commands
    ```

1. (optional) Run the database migration

    If the pull request is marked with the `migration` label, it modifies the
    database schema, and you thus need to update the schema locally as well.

    First, backup the current development database by running the following in
    the development container's console (you will be prompted for the database
    root password):

    ```console
    mysqldump ggrcdev -u root -p > db_backup.sql
    ```

    With the backup successfully created, run the actual database migration:

    ```console
    db_migrate
    ```

    _NOTE: Database migration must be run from the latest database state on
    the main `develop` branch. If your topic branch introduced any DB changes,
    they must first be reverted before running the migration._

1. Rebuild all asset files and launch the application:

    ```console
    deploy_appengine extras/deploy_settings_local.sh
    launch_ggrc
    ```

1. Test the application in incognito mode.

    _HINT: For incognito mode in Chrome press
    <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>n</kbd>
    (or <kbd>⌘Cmd</kbd>+<kbd>Shift</kbd>+<kbd>n</kbd> on Mac)_

    _NOTE: You have to close all current incognito browsers to get a clean
    session._

    Test the pull request as decribed in the
    [relevant section](#reviewing-and-merging-pull-requests) of this guide.

1. Go back to your branch and continue with your work:

    After you have finished verifying the pull request, you can remove the
    temporary branch that was used for testing it:

    ```console
    git checkout develop
    git branch -D temp_branch
    ```

    ```console
    git checkout my/previous-branch
    git stash pop  # only needed if you had any changes stashed in Step 1
    ```

    If you tested a `migration` pull request, you should also revert the
    database to its previous state by running the following from the
    development container's console:
    ```console
    mysql -u root -p ggrcdev < db_backup.sql
    ```

\[[Back to top](#top)\]

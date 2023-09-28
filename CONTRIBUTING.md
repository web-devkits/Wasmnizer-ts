# Contributing

### License

`Wasmnizer-ts` is licensed under the terms in [LICENSE](./LICENSE). By contributing to the project, you agree to the license and copyright terms therein and release your contribution under these terms.

### How to contribute

We welcome contributions to Wasmnizer-ts. You can:

- Log a bug or provide feedback with an [issue].
- Submit your changes directly with a [pull request].

### Pull requests

This project follows a simple workflow with contributions delivered as [pull requests](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/about-pull-requests) (PR) against the main branch.

To submit your change:

- Make sure your code is in line with our coding conventions by running `npm run lint` to format the
  code.
- Create an [issue] describing the bug the PR fixes or the feature you intend to implement.
- Submit a [pull request] into the main branch.

Your PR will then be reviewed by one or more maintainers. Your PR will be automatically merged
(assuming no conflicts) with one approving review. Maintainers may suggest changes to a PR before
approving.

### Testing

#### Test compilation

This will compile our samples and check if the compiler exit normally, it doesn't guarantee the correctness of the generated wasm module.

``` bash
npm run test
```

#### Validate execution on WAMR

See [validate/wamr](./tools/validate/wamr/README.md) for how to validate results on WAMR

### Code Formatting

Code is required to be formatted with `npm run lint`.


### Sign your work

Please use the sign-off line at the end of the patch. Your signature certifies that you wrote the patch or otherwise have the right to pass it on as an open-source patch. The rules are pretty simple: if you can certify
the below (from [developercertificate.org](http://developercertificate.org/)):

```
Developer Certificate of Origin
Version 1.1

Copyright (C) 2004, 2006 The Linux Foundation and its contributors.
660 York Street, Suite 102,
San Francisco, CA 94110 USA

Everyone is permitted to copy and distribute verbatim copies of this
license document, but changing it is not allowed.

Developer's Certificate of Origin 1.1

By making a contribution to this project, I certify that:

(a) The contribution was created in whole or in part by me and I
    have the right to submit it under the open source license
    indicated in the file; or

(b) The contribution is based upon previous work that, to the best
    of my knowledge, is covered under an appropriate open source
    license and I have the right under that license to submit that
    work with modifications, whether created in whole or in part
    by me, under the same open source license (unless I am
    permitted to submit under a different license), as indicated
    in the file; or

(c) The contribution was provided directly to me by some other
    person who certified (a), (b) or (c) and I have not modified
    it.

(d) I understand and agree that this project and the contribution
    are public and that a record of the contribution (including all
    personal information I submit with it, including my sign-off) is
    maintained indefinitely and may be redistributed consistent with
    this project or the open source license(s) involved.
```

Then you just add a line to every git commit message:

    Signed-off-by: Joe Smith <joe.smith@email.com>

Use your real name (sorry, no pseudonyms or anonymous contributions.)

If you set your `user.name` and `user.email` git configs, you can sign your
commit automatically with `git commit -s`.

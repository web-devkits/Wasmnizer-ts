#
# Copyright (C) 2023 Intel Corporation.  All rights reserved.
# SPDX-License-Identifier: Apache-2.0 WITH LLVM-exception
#

FROM node:16.16.0

ARG USERNAME=vscode
ARG USER_UID=1000
ARG USER_GID=$USER_UID

# node may come with an older version of npm. Ensure we have a specific npm.
RUN npm install -g npm@8.11.0


################################################################################
# Install prerequisites
RUN apt update
RUN apt install -y \
    lsb-release vim \
    curl wget
RUN apt install -y \
    build-essential cmake g++-multilib libgcc-8-dev lib32gcc-8-dev

## lsb-release  allows us to find out which distro we run inside the dev container


# Add binaryen
RUN wget https://github.com/WebAssembly/binaryen/releases/download/version_114/binaryen-version_114-x86_64-linux.tar.gz
RUN tar zxvf binaryen-version_114-x86_64-linux.tar.gz
RUN ln -s binaryen-version_114/bin/wasm-as /usr/local/bin/wasm-as
RUN ln -s binaryen-version_114/bin/wasm-opt /usr/local/bin/wasm-opt
RUN ln -s binaryen-version_114/bin/wasm-shell /usr/local/bin/wasm-shell

# Create the non-root user
RUN userdel -r -f node  \
    && groupadd --gid $USER_GID $USERNAME \
    && useradd --uid $USER_UID --gid $USER_GID -m $USERNAME \
    && usermod --shell /bin/bash vscode \
    #
    # [Optional] Add sudo support. Omit if you don't need to install software after connecting.
    && apt-get update \
    && apt-get install -y sudo \
    && echo $USERNAME ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME \
    && chmod 0440 /etc/sudoers.d/$USERNAME

USER $USERNAME

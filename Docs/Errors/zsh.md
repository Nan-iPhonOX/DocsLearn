# 错误信息收集及处理方法

## zsh  安装p10k主题报错

### 报错内容

```zsh

[WARNING]: Console output during zsh initialization detected.

When using Powerlevel10k with instant prompt, console output during zsh
initialization may indicate issues.

You can:

  - Recommended: Change ~/.zshrc so that it does not perform console I/O
    after the instant prompt preamble. See the link below for details.

    * You will not see this error message again.
    * Zsh will start quickly and prompt will update smoothly.

  - Suppress this warning either by running p10k configure or by manually
    defining the following parameter:

      typeset -g POWERLEVEL9K_INSTANT_PROMPT=quiet

    * You will not see this error message again.
    * Zsh will start quickly but prompt will jump down after initialization.

  - Disable instant prompt either by running p10k configure or by manually
    defining the following parameter:

      typeset -g POWERLEVEL9K_INSTANT_PROMPT=off

    * You will not see this error message again.
    * Zsh will start slowly.

  - Do nothing.

    * You will see this error message every time you start zsh.
    * Zsh will start quickly but prompt will jump down after initialization.

For details, see:
https://github.com/romkatv/powerlevel10k/blob/master/README.md#instant-prompt

-- console output produced during zsh initialization follows --

```

### 处理方法

使用推荐的第一个 关闭instant prompt mode。

```zsh
# ~/.p10k.zsh

  # Instant prompt mode.
  #
  #   - off:     Disable instant prompt. Choose this if you've tried instant prompt and found
  #              it incompatible with your zsh configuration files.
  #   - quiet:   Enable instant prompt and don't print warnings when detecting console output
  #              during zsh initialization. Choose this if you've read and understood
  #              https://github.com/romkatv/powerlevel10k/blob/master/README.md#instant-prompt.
  #   - verbose: Enable instant prompt and print a warning when detecting console output during
  #              zsh initialization. Choose this if you've never tried instant prompt, haven't
  #              seen the warning, or if you are unsure what this all means.
  typeset -g POWERLEVEL9K_INSTANT_PROMPT=off
```
## FZF 默认选项报错

### 报错内容

```zsh
$FZF_DEFAULT_OPTS: invalid command line string
```

### 处理方法


sudo apt install make
sudo apt install autoconf
sudo apt install libicu-dev libreadline-dev
sudo apt install pkg-config
sudo apt install zlib1g-dev
sudo apt install libperl-dev

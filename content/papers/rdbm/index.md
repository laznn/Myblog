---
title: "RDBM：把图像修复写成一条残差驱动的扩散桥"
date: 2026-07-30T00:00:00+08:00
lastmod: 2026-07-30T00:00:00+08:00
draft: false
description: "从 OU 过程、扩散桥到残差自适应噪声，完整推导 Residual Diffusion Bridge Model 的数学路径。"
summary: "RDBM 的重点不是再加一个网络模块，而是重新设计图像修复中的随机过程：退化区域多扰动，干净区域少扰动，并用统一框架解释多种扩散桥。"
categories: ["Image Restoration"]
tags: ["Diffusion", "Diffusion Bridge", "数学推导", "论文阅读"]
keywords: ["RDBM", "Residual Diffusion Bridge Model", "OU Process", "Diffusion Bridge", "RNR"]
paper_url: "https://openaccess.thecvf.com/content/CVPR2026/papers/Wang_Residual_Diffusion_Bridge_Model_for_Image_Restoration_CVPR_2026_paper.pdf"
venue: "CVPR 2026"
weight: 1
---

{{< katex >}}

> **论文**：*Residual Diffusion Bridge Model for Image Restoration*，CVPR 2026。  
> **一句话概括**：RDBM 不再对整张图统一加噪，而是用高清图与低质图的残差决定每个位置的噪声强度，并把 OU Bridge、Brownian Bridge、I²SB 和 Flow Matching 放进同一个数学框架。

## 先说清楚：OU 和 ODE 不是一回事

OU（Ornstein–Uhlenbeck）过程是一个**随机微分方程**：

$$
dx_t=\theta_t(\mu-x_t)dt+\sigma_t\,d\omega_t.
$$

其中 (\theta_t(\mu-x_t)) 是把状态拉向均值 (\mu) 的漂移项，(\sigma_t d\omega_t) 是随机噪声项。只要 (\sigma_t\neq0)，同一个初始状态也可能走出不同轨迹。

ODE 是确定性常微分方程：

$$
\frac{dx_t}{dt}=v_\phi(x_t,t).
$$

给定初值和速度场后，理论上只有一条轨迹。扩散模型里常说的 probability-flow ODE，是把某个随机 SDE 的边缘分布改写成一个确定性 ODE；它和原 SDE 可以拥有相同的时间边缘分布，但单条采样轨迹并不相同。

因此，OU 是“带均值回复的随机过程”，ODE 是“确定性的演化方程”。当 RDBM 设置 (\pi=0) 时，噪声项消失，才会退化成 Flow Matching 一类的确定性流；普通 OU 本身不是 ODE。

## 为什么 OU 只能趋近均值，不能保证到达均值

先考虑常数 (\theta,\sigma) 的 OU 过程。令 (y_t=x_t-\mu)，则

$$
dy_t=-\theta y_tdt+\sigma d\omega_t.
$$

乘以积分因子 (e^{\theta t})：

$$
d(e^{\theta t}y_t)=\sigma e^{\theta t}d\omega_t.
$$

从 (0) 积分到 (t)，得到

$$
x_t=\mu+(x_0-\mu)e^{-\theta t}+\sigma\int_0^t e^{-\theta(t-s)}d\omega_s.
$$

于是

$$
\mathbb E[x_t\mid x_0]=\mu+(x_0-\mu)e^{-\theta t},
$$

$$
\operatorname{Var}(x_t\mid x_0)=\sigma^2\int_0^t e^{-2\theta(t-s)}ds
=\frac{\sigma^2}{2\theta}(1-e^{-2\theta t}).
$$

当 (t\to\infty) 时，均值趋于 (\mu)，但方差趋于 (\sigma^2/(2\theta))，并不趋于零。因此 OU 的终点不是一个确定的点，而是围绕 (\mu) 的高斯分布：

$$
x_\infty\sim\mathcal N\left(\mu,\frac{\sigma^2}{2\theta}I\right).
$$

这就是“只能趋近均值”的准确含义：漂移项负责拉回均值，噪声项不断把状态推离均值。除非令噪声消失，或额外施加终点条件，否则它不会精确落在 (\mu) 上。

## 从 OU 到 OU Bridge

图像修复中有一对样本：高清图 (x_0=x_{HQ})，低质图 (\mu=x_{LQ})。普通 OU 只会随机趋近 (\mu)，所以论文先写出带噪声缩放的广义过程：

$$
dx_t=\theta_t(\mu-x_t)dt+\pi\sigma_t d\omega_t.
$$

定义漂移与扩散的固定比例：

$$
\lambda=\frac{\sigma_t^2}{2\theta_t}.
$$

通过 Doob 的 (h)-transform，对过程施加终点条件 (x_T=\mu)，得到扩散桥：

$$
dx_t=\theta_t\coth(\theta_{t:T})(\mu-x_t)dt
+\sqrt{2\pi^2\lambda\theta_t}\,d\omega_t,
$$

其中

$$
\theta_{s:t}=\int_s^t\theta_zdz.
$$

相比普通 OU，桥过程的漂移中出现 (\coth(\theta_{t:T}))。当 (t\) 接近终点 (T) 时，这个系数会变大，强迫轨迹更快地回到指定终点，这正是“桥”的数学来源。

## 闭式解：残差和噪声的加权组合

该 SDE 可以解出：

$$
x_t=\mu+(x_0-\mu)\frac{\sinh(\theta_{t:T})}{\sinh(\theta_{0:T})}
+\int_0^t\sqrt{2\pi^2\lambda\theta_s}
\frac{\sinh(\theta_{t:T})}{\sinh(\theta_{s:T})}d\omega_s.
$$

记

$$
\Theta_t=\frac{\sinh(\theta_{t:T})}{\sinh(\theta_{0:T})},
$$

则条件均值为

$$
\mathbb E[x_t\mid x_0,\mu]=\mu+(x_0-\mu)\Theta_t.
$$

令

$$
\Sigma_t^2=2\lambda\frac{\sinh(\theta_{0:t})\sinh(\theta_{t:T})}{\sinh(\theta_{0:T})},
$$

就有

$$
x_t\mid x_0,\mu\sim
\mathcal N\bigl(\mu+(x_0-\mu)\Theta_t,\pi^2\Sigma_t^2I\bigr).
$$

这条式子很重要：中间状态由两部分组成，一部分是高清图相对于低质图的残差，另一部分是高斯扰动。(\Theta_t) 控制残差随时间衰减，(\pi\Sigma_t) 控制噪声强度。

## RDBM 的关键：令噪声跟着残差走

传统桥模型大多取 (\pi=1)，意味着每个像素都使用相同的噪声尺度。RDBM 改为

$$
\pi(i,j)=x_{HQ}(i,j)-x_{LQ}(i,j).
$$

于是训练时直接采样：

$$
x_t=\mu+(x_0-\mu)\Theta_t+\pi\Sigma_t\epsilon,
\qquad \epsilon\sim\mathcal N(0,I).
$$

如果某个像素在 HQ 与 LQ 中几乎相同，那么 (\pi\) 很小，正向过程不会反复破坏它；如果某个位置存在明显退化，(\pi) 较大，模型可以获得更强的随机自由度去重建纹理。

论文进一步定义残差—噪声比（RNR）：

$$
R(i,j,t)=\frac{(x_0(i,j)-\mu(i,j))^2}{2\pi(i,j)^2\lambda}
\frac{\sinh(\theta_{t:T})}{\sinh(\theta_{0:t})\sinh(\theta_{0:T})}.
$$

代入 (\pi=x_0-\mu) 后，像素残差项约掉，得到只由时间调度决定的比例：

$$
R(t)\propto
\frac{\sinh(\theta_{t:T})}{\sinh(\theta_{0:t})\sinh(\theta_{0:T})}.
$$

这使不同像素共享平滑的时间演化，同时保留空间上的自适应噪声幅度。

## 反向过程与训练目标

由上面的高斯转移分布，可以写出相邻状态：

$$
q(x_t\mid x_0,\mu)=\mathcal N(\mu+(x_0-\mu)\Theta_t,\pi^2\Sigma_t^2I).
$$

反向采样时，模型从 (x_t) 预测 (x_{t-1})。理想目标是让模型分布 (p_\phi(x_{t-1}\mid x_t,\mu)) 匹配真实后验：

$$
\mathcal L(\phi)=
\mathbb E\left[D_{KL}\left(q(x_{t-1}\mid x_t,x_0,\mu)\,\|\,p_\phi(x_{t-1}\mid x_t,\mu)\right)\right].
$$

在两边都采用固定方差的高斯形式时，最小化 KL 等价于匹配均值；再把均值项整理成噪声预测形式，可得到：

$$
\mathcal L_\epsilon=
\mathbb E_{x_0,\mu,t,\epsilon}
\left\|\pi\epsilon-\hat\pi_\phi(x_t,t,\mu)\right\|_1.
$$

网络并不是单独预测 (\pi) 和 (\epsilon)，而是预测它们的乘积。训练算法可以概括为：

1. 取高清图 (x_0) 和对应低质图 (\mu)；
2. 随机采样时间步 (t) 和高斯噪声 (\epsilon)；
3. 按 (x_t=\mu+(x_0-\mu)\Theta_t+\pi\Sigma_t\epsilon) 构造中间状态；
4. 用网络预测 (\pi\epsilon)；
5. 通过 L1 损失训练预测结果。

## 其他桥模型为什么是它的特例

RDBM 用三个量控制过程：全局噪声水平 (\lambda)、时间动力学 (\theta_t)、噪声调制 (\pi)。不同设置对应不同模型：

$$
\pi=0\Rightarrow\text{Flow Matching / 确定性 ODE},
$$

$$
\pi=1\Rightarrow\text{OU Bridge 或 Brownian Bridge 一类的全局加噪桥},
$$

$$
\pi=x_0-\mu\Rightarrow\text{RDBM 的残差自适应桥}.
$$

因此“大一统”并不是说它重新实现了所有模型，而是说这些模型可以看成同一个广义过程在参数空间中的不同位置。

## 最后的判断

这篇论文确实比普通的“加一个模块、涨几个点”更偏基础研究。它的核心贡献有三层：用 OU 与 Doob 变换构造通用桥过程；用残差控制像素级噪声；用 RNR 解释不同桥模型之间的关系。

它当然不是凭空创造 Diffusion，OU、Brownian Bridge、Schrödinger Bridge 和 Flow Matching 都有前置工作。真正新的地方，是把这些工具针对图像修复重新组织起来，并回答了一个很具体的问题：为什么完好的区域也要承受和退化区域一样的随机扰动？

要做出这样的工作，确实需要较强的概率论、随机微分方程和扩散模型基础，也需要大量消融实验验证每个参数设定。不过数学推导不是装饰，它直接决定了训练路径、噪声分布和模型最终能否保护背景细节。这也是我认为 RDBM 比单纯的结构改造更有研究味道的原因。

原论文：[Residual Diffusion Bridge Model for Image Restoration](https://openaccess.thecvf.com/content/CVPR2026/papers/Wang_Residual_Diffusion_Bridge_Model_for_Image_Restoration_CVPR_2026_paper.pdf)

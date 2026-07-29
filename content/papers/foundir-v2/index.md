---
title: "FoundIR-v2：统一图像恢复也是一个资源调度问题"
date: 2026-07-29
lastmod: 2026-07-29
draft: false
description: "从数据均衡调度和 MoE 扩散调度器理解 FoundIR-v2：方法并不花哨，但抓住了统一图像恢复中数据与模型两端的能力失衡。"
summary: "FoundIR-v2 的两个核心创新并不复杂：在输入端动态调整各任务的数据比例，在模型端利用 MoE 分配任务自适应扩散先验。真正值得关注的是，它把统一图像恢复重新理解成了一个资源调度问题。"
categories: ["Image Restoration"]
tags: ["All-in-One Restoration", "Diffusion", "MoE", "论文阅读"]
keywords: ["FoundIR-v2", "All-in-One Image Restoration", "Data Equilibrium Scheduling", "Mixture of Experts", "SDXL"]
paper_url: "https://arxiv.org/abs/2512.09282"
paper_authors: ["Xiang Chen", "Jinshan Pan", "Jiangxin Dong", "Jian Yang", "Jinhui Tang"]
venue: "CVPR 2026"
weight: 1
---

{{< katex >}}

> **论文**：Xiang Chen, Jinshan Pan, Jiangxin Dong, Jian Yang, Jinhui Tang. *FoundIR-v2: Optimizing Pre-Training Data Mixtures for Image Restoration Foundation Model*, CVPR 2026.  
> **一句话概括**：在数据端动态调整不同恢复任务的采样比例，在模型端利用 MoE 动态分配扩散先验。

读完 FoundIR-v2，我最初的感觉其实很直接：它和其他 All-in-One Restoration 方法好像没有本质区别，不就是在扩散模型中加入了多个专家，然后取得了比较好的结果吗？

但重新梳理方法后，我觉得这篇论文真正值得关注的不是某个新奇模块，而是它对问题的划分非常清楚。统一图像恢复模型会同时面对两种失衡：

1. **数据失衡**：去模糊、去雾、低光、超分辨率等任务的数据应该以什么比例参与训练？
2. **模型能力失衡**：同一个扩散模型如何为不同退化分配合适的网络参数和生成先验？

FoundIR-v2 分别从输入数据和模型参数两端进行调度。换句话说，它把 All-in-One Image Restoration 看成了一个资源分配问题。

## 为什么直接混合多任务数据并不可靠

设基础模型为 \(\mathcal M_0\)，参数为 \(\theta\in\mathbb R^M\)。大规模训练集 \(\mathcal D_{tr}\) 按任务属性划分成 \(k\) 个数据域：

\[
\mathcal D_{tr}=\mathcal D_1\cup\mathcal D_2\cup\cdots\cup\mathcal D_k.
\]

最简单的做法，是把所有任务数据放在一起随机采样。但不同任务的数据规模、退化难度和优化方向并不相同，任务之间还可能相互促进或相互冲突。即使总数据量和模型结构完全不变，不同的数据混合比例也会产生明显不同的结果。

论文使用 \(\lambda=(\lambda_1,\ldots,\lambda_k)\) 表示各任务域的采样概率，并定义训练数据分布：

\[
P_{\lambda}
=
\sum_{i=1}^{k}\lambda_i\,\mathrm{unif}(\mathcal D_i),
\]

其中

\[
\mathrm{unif}(\mathcal D)
=
\frac{1}{|\mathcal D|}\sum_{x\in\mathcal D}\delta_x
\]

表示数据集内部的均匀分布。这里的 \(\lambda_i\) 决定训练过程中看到第 \(i\) 类任务的概率。

对给定的数据比例 \(\lambda\)，模型通过重建损失学习相应的最优参数：

\[
\theta_{\lambda}^{*}
=
\operatorname*{arg\,min}_{\theta}
\mathbb E_{(I_{LQ},I_{HQ})\sim P_{\lambda}}
\left[
\left\|I_{HQ}-\mathcal M_{\theta}(I_{LQ})\right\|_1
\right].
\]

这也说明 \(\lambda\) 不是一个无关紧要的训练配置：采样分布不同，模型最终得到的参数和能力分布也会不同。

## 静态比例实验不是最终答案

论文首先比较了多组静态固定数据混合比例。这个实验不是为了穷举出一个永远最优的配方，而是为了证明：**数据比例本身会直接影响统一恢复模型的综合能力。**

如果最终只是人工挑一组固定比例，这个结论的价值仍然有限。一方面，大规模预训练不可能反复穷举；另一方面，最合适的比例也可能随训练阶段发生变化。

因此，FoundIR-v2 的答案不是寻找一个固定比例，而是让比例在训练过程中动态变化。

## Data Equilibrium Scheduling：根据学习趋势调整数据

在第 \(t\) 个训练阶段，模型在独立参考集 \(\mathcal D_{ref}\) 上得到各任务性能：

\[
s_1^{(t)},s_2^{(t)},\ldots,s_k^{(t)}.
\]

每隔 \(T\) 个训练步，算法将当前性能与上一次检查结果进行比较：

\[
\Delta s_j^{(t)}
=
s_j^{(t)}-s_j^{(t-T)}.
\]

随后更新任务 \(j\) 的采样比例：

\[
\lambda_j^{(t+1)}
=
\frac{
\lambda_j^{(t)}\exp\left(-\alpha\Delta s_j^{(t)}\right)
}{
\sum_{i=1}^{k}
\lambda_i^{(t)}\exp\left(-\alpha\Delta s_i^{(t)}\right)
},
\]

其中 \(\alpha>0\) 控制权重调整的灵敏度。

这个公式可以直观地理解为一个负反馈控制器：

- 若某项任务性能下降，即 \(\Delta s_j^{(t)}<0\)，其指数项变大，下一阶段倾向于提高该任务的采样比例；
- 若某项任务仍在进步，即 \(\Delta s_j^{(t)}>0\)，则可以适当把训练资源让给其他任务；
- 所有权重经过归一化，始终满足 \(\sum_j\lambda_j=1\)。

严格来说，一个任务的比例是否最终上升，还取决于其他任务的相对变化，因为公式包含全局归一化。但其基本思想非常清楚：哪里开始掉点，就往哪里补充监督。

## 我认为最巧的是：看趋势，而不是看绝对分数

假设有两个任务：

- 任务 A 的绝对分数比较低，但一直稳定上升；
- 任务 B 的绝对分数很高，但最近开始下降。

如果按照当前分数高低分配数据，任务 A 可能因为“看起来比较差”而被持续加码。但它可能只是天然更困难，实际上并没有学坏。与此同时，任务 B 虽然分数仍然很高，却已经出现遗忘或任务冲突。

FoundIR-v2 比较的是当前结果和 \(T\) 步前结果，因此会优先关注任务 B 的下降趋势。这避免了“困难任务永远获得更多数据”的不合理现象。

参考集 \(\mathcal D_{ref}\) 与训练集相互独立，而且每个任务包含相同数量的样本。这可以避免训练集样本数量直接影响评测，让每次调整拥有相对公平、稳定的依据。

不过，这种方法仍然不是完全无参数的最优比例搜索。参考集规模、评测指标、检查间隔 \(T\) 和缩放因子 \(\alpha\) 都会影响调度结果。更准确地说，它是在训练过程中在线修正明显失衡的数据比例，而不是严格求解一个全局最优配方。

## MoE-driven Diffusion Scheduler：在参数层面分配先验

数据均衡调度解决了“不同任务的数据怎么喂”，但同一套模型参数仍然需要处理性质差异很大的退化。

例如，去模糊强调结构和边缘恢复，去雾需要处理全局对比度，低光增强涉及亮度与噪声耦合，超分辨率又需要生成高频纹理。如果对所有任务无差别地使用同一种扩散先验，模型能力仍可能失衡。

FoundIR-v2 以 SDXL 为扩散骨干。HQ 图像经过预训练 VAE 编码并加入时间步噪声，形成带噪潜变量；LQ 图像则通过 LQ Encoder 提取条件特征。二者融合后送入 MoE-driven scheduler：

\[
z_t^{(k)}=\phi\left(f_k^{LQ},x_{t,k}^{HQ}\right).
\]

Router 根据当前输入生成专家权重 \(w_i^{(k)}\)，再对多个专家的输出进行软融合：

\[
F_{out}^{(k)}
=
\sum_{i=1}^{n}w_i^{(k)}E_i\left(z_t^{(k)}\right).
\]

这里需要注意：专家并不是被人工硬性指定为“去模糊专家”“去雾专家”或“超分专家”。论文中的共享专家采用不同的特征建模方式，Router 根据输入动态组合它们。某些专家可能在训练后对特定退化形成偏好，但这种分工是模型自动学习出来的，并不和人工任务标签一一对应。

除此之外，论文还利用 LLaVA 为训练图像生成描述，通过文本条件进一步调用 SDXL 的生成先验；同时使用图像质量评价模型进行 GT Data Cleaning，减少低质量目标图像带来的冲突监督。

## 两种调度分别解决什么

| 调度位置 | 要解决的问题 | FoundIR-v2 的处理方式 |
|---|---|---|
| 输入数据层面 | 不同任务训练程度不平衡 | 根据参考集性能变化动态调整采样比例 |
| 模型参数层面 | 不同退化需要不同的生成先验 | Router 对多个专家进行软选择和加权融合 |

这也是我认为论文结构最清楚的地方：它不是只在模型中加入 MoE，而是分别从数据和模型两端处理资源失衡。

## 我的看法：创新不多，但问题抓得准

读到最后，我仍然觉得 FoundIR-v2 的主要创新就是这两个。动态任务采样、Mixture-of-Experts 和扩散先验都不是第一次出现，单独拆开来看并不令人意外。

但这两个点确实比较好。

Data Equilibrium Scheduling 把以往依靠经验设定的数据比例变成了一个周期反馈过程；MoE-driven scheduler 则避免同一个生成先验机械地服务所有退化。两者分别对应“训练资源如何分配”和“模型能力如何分配”，形成了完整的双调度框架。

它能够被 CVPR 接收，我认为也不只是因为涨点比较高。更重要的是：

1. 问题定义非常具体，数据混合比例确实长期容易被忽视；
2. 动机实验直观展示了比例变化造成的性能波动；
3. 方法容易理解，并且能够迁移到其他多任务训练框架；
4. 模型覆盖超过 50 个恢复子任务，实验规模和工程量足够充分；
5. 最终效果证明这种看似简单的调度确实能够改善统一恢复能力。

所以，我对这篇论文的最终评价是：

> FoundIR-v2 的创新密度未必很高，但它抓住了 All-in-One Image Restoration 中两个真实且重要的失衡问题。方法不花哨，闭环却很完整；比起再堆一个复杂模块，这种从训练过程本身寻找瓶颈的工作可能更值得借鉴。

原论文：[FoundIR-v2: Optimizing Pre-Training Data Mixtures for Image Restoration Foundation Model](https://arxiv.org/abs/2512.09282)  
代码：[cschenxiang/FoundIR-v2](https://github.com/cschenxiang/FoundIR-v2)

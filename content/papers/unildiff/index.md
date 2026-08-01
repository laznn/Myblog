---
title: "UniLDiff：把已有模块放到正确的位置"
date: 2026-07-29
lastmod: 2026-07-29
draft: false
description: "UniLDiff 并没有发明动态融合或 MoE，它针对 Latent Diffusion 的时间条件错配与 VAE 细节损失，将两个已有思想放到了更合适的位置。"
summary: "DAFF 负责在扩散轨迹中对齐 LQ 条件，DAEM 负责在 VAE 解码阶段补偿细节。相比 FoundIR-v2，UniLDiff 的研究问题更具体，也更偏网络结构工程。"
categories: ["Image Restoration"]
tags: ["All-in-One Restoration", "Diffusion", "MoE", "论文阅读"]
keywords: ["UniLDiff", "DAFF", "DAEM", "All-in-One Image Restoration", "Latent Diffusion"]
paper_url: "https://arxiv.org/abs/2507.23685"
paper_authors: ["Zihan Cheng", "Liangtai Zhou", "Dian Chen", "Ni Tang", "Xiaotong Luo", "Yuan Xie", "Yanyun Qu"]
venue: "CVPR 2026"
weight: 2
---

{{< katex >}}

> **论文**：Cheng et al. *UniLDiff: Unlocking the Power of Diffusion Priors for All-in-One Image Restoration*, CVPR 2026.  
> **一句话概括**：在扩散阶段动态对齐 LQ 条件，在 VAE 解码阶段利用稀疏专家补偿高频细节。

UniLDiff 最早在 2025 年 7 月发布于 arXiv，随后被 CVPR 2026 接收。看完摘要，我最初的疑问是：动态融合、退化感知和 Mixture-of-Experts 在 2025 年显然都不新，为什么它仍然能作为两个主要创新点被 CVPR 接收？

重新看完方法和消融后，我的理解是：UniLDiff 并没有发明这些基本思想。它的贡献在于针对 Latent Diffusion 图像恢复的两个具体缺陷，把已有组件放到了比较准确的位置。

## 两个模块分别修补什么

Latent Diffusion 做统一图像恢复时存在两类问题：

1. 随着去噪过程推进，时变潜变量 $x_t$ 不断变化，固定的 LQ 条件注入方式未必始终合适；
2. VAE 的高倍率压缩和迭代采样容易损失纹理、边缘与细小结构。

UniLDiff 对应设计了两个模块：

| 模块 | 放置位置 | 主要作用 |
|---|---|---|
| DAFF | Diffusion UNet 浅层 | 在每个时间步对齐 LQ 特征与当前潜变量 |
| DAEM | VAE Decoder 内部 | 利用跳跃特征和稀疏专家恢复局部细节 |

因此，DAFF 负责扩散轨迹上的退化引导，DAEM 负责解码阶段的空间细节增强。

## “以前都只是相加或拼接”并不严谨

论文将现有方法的局限概括为：直接把 LQ 特征与时变潜变量相加或拼接，使用静态融合方式处理整个去噪过程。

如果把这句话理解成“此前所有扩散恢复方法都只会简单相加”，显然不准确。此前已经有 Cross-Attention、ControlNet 式多尺度注入、Adapter、条件归一化、动态门控和退化 Prompt 等大量设计。

而且，即使融合算子是拼接，输出也不完全静态。$x_t$ 本身在变化，UNet 还接收时间嵌入，经过非线性网络后，每一步的响应自然不同。

作者真正针对的是一个更窄的问题：

> 一些 LDM 恢复框架的条件注入结构本身是固定的，没有显式建模 LQ 特征与当前 $x_t$ 之间随时间步变化的对齐关系。

所以 DAFF 的创新不是“首次动态融合”，而是把 timestep-aware feature alignment 明确做成了独立模块。

## DAFF：先解耦，再联合融合

DAFF 由 Double Stream Block 和 Single Stream Block 串联组成，结构明显受到 FLUX 双流—单流架构的启发。

### Double Stream Block

输入包括 LQ 编码器提取的退化特征 $f^{LQ}$，以及当前扩散时间步的带噪潜变量 $x_t^{HQ}$。两路特征先分开处理，分别完成归一化、条件调制和 Q/K/V 投影，再通过注意力进行交互。

这样做的目标是暂时保留两类特征各自的属性：

- LQ 分支提供可观测结构和退化信息；
- 潜变量分支保留扩散模型当前的生成状态；
- 二者先对齐，避免一开始就粗暴混合造成信息污染。

### Single Stream Block

双流交互后的特征被拼接到统一序列中，通过联合注意力进一步融合，并利用门控残差得到对齐结果：

$$ f_t^{align}=f_t^{cat}+g\cdot\operatorname{Linear}_2\left(A_t^S,\phi(M)\right). $$

其中门控与时间条件共同影响融合结果，使网络可以在不同时间步采取不同的条件注入策略。

一种合理直觉是：去噪早期更多依赖 LQ 观测确定内容与结构，后期则减少退化特征对干净图像生成的干扰。不过，如果没有观察到门控权重随时间变化的曲线，就不能进一步断言融合强度一定随时间单调下降。更严谨的表述是：**DAFF 允许模型学习时间步相关的融合行为。**

## GPT-4o 是不是贡献了全部效果

论文还使用图生文模型（例如 GPT-4o）生成内容描述，将文本嵌入 $c$ 与 $f_t^{align}$ 通过轻量交叉注意力融合。文本条件确实有用，但消融结果表明，它不是全部提升的来源。

| DAFF | Task Prompt | DAEM | PSNR | MUSIQ |
|---|---:|---:|---:|---:|
| 无 | 无 | 无 | 23.12 | 41.31 |
| 无 | 有 | 无 | 25.87 | 50.12 |
| 有 | 无 | 无 | 27.14 | 61.35 |
| 有 | 有 | 无 | 27.36 | 62.77 |
| 有 | 有 | 有 | 30.27 | 63.06 |

只加入 Prompt，性能确实明显提高；但只加入 DAFF 的结果更好。已有 DAFF 后，Prompt 带来的边际收益只有约 0.22 dB PSNR 和 1.42 MUSIQ。

所以我的判断是：GPT-4o 提供了有效的全局语义辅助，但 DAFF 才是退化对齐和感知质量提升的主要来源之一。真正带来最大 PSNR 增益的反而是 DAEM。

## DAEM：在 VAE Decoder 内补偿细节

经过 Diffusion UNet 去噪后，潜变量已经包含较完整的全局结构，但 VAE 压缩会丢失高频信息。不同空间区域的需求也不相同：平坦区域需要稳定的颜色重建，纹理区域则需要更强的局部建模。

DAEM 将解码特征与 VAE Encoder 的高分辨率跳跃特征结合，通过稀疏 Router 选择专家：

$$ \operatorname{Router}(x)=\operatorname{top-k}\left(\operatorname{Softmax}(Wx+\xi)\right),\qquad k=1. $$

论文中的专家由具有不同感受野的轻量 NAFBlock 构成。Top-1 路由意味着每个位置只激活一个专家，可以控制额外计算量。

专家输出还会受到共享全局分支的乘法调制：

$$ \hat y_i^E=E_i(x)\otimes S(x). $$

可以把共享分支理解为全局结构约束，专家则负责局部模式修正。与把 MoE 放在 Diffusion UNet 内部进行任务级先验分配相比，DAEM 的位置和目标更具体：它主要补偿 VAE 解码阶段的空间细节损失。

不过，不能直接把专家解释为“纹理专家”“边缘专家”和“去伪影专家”。论文显式设置的是不同感受野，具体语义分工由训练形成，并没有对应的人工监督。

## 两阶段训练

第一阶段先进行退化建模：冻结预训练 VAE Encoder 和 Denoising UNet，只训练 DAFF；待其初步收敛后，再解冻可训练的 LQ Encoder 和 Denoising UNet，与 DAFF 联合优化。使用标准噪声预测目标：

$$ \mathcal L_{stage\text{-}1}=\left\|\epsilon-\hat\epsilon_\theta\left(\sqrt{\bar\alpha_t}x_0^{HQ}+\sqrt{1-\bar\alpha_t}\epsilon,f^{LQ},c,t\right)\right\|_1. $$

第二阶段联合微调 VAE Decoder 和 DAEM，使用：

$$ \mathcal L_{stage\text{-}2}=\mathcal L_{recon}+\lambda_1\mathcal L_{ssim}+\lambda_2\mathcal L_{aux}. $$

其中 $\mathcal L_{aux}$ 是负载均衡损失，用来防止 Top-1 Router 长期集中选择少数专家。

## 它没有提出新的图像数据集

UniLDiff 主要使用已有公开数据：BSD400 与 WED 用于去噪，Rain100L 用于去雨，RESIDE/SOTS 用于去雾，GoPro 用于去模糊，LOL-v1 用于低光增强；另外在复合退化设置和屏下相机数据上进行评测。

GPT-4o 为已有图像生成文字描述，只是增加文本条件，并不构成新的图像恢复数据集。这一点与强调大规模真实数据和数据混合规律的 FoundIR 系列明显不同。

## 为什么这些已有思想仍能被 CVPR 接收

CVPR 并不要求论文中的每个部件都是第一次出现。UniLDiff 的完整论证链条是：

1. LQ 条件与时变潜变量存在显式对齐不足；
2. 双流负责解耦与交互，单流负责联合融合，时间条件负责自适应调制；
3. VAE 压缩造成细节损失，因此在 Decoder 内加入不同感受野的稀疏专家；
4. 单一、复合和零样本退化实验验证了方法；
5. 消融证明完整 DAFF 明显优于无融合、单流、双流和普通残差注意力。

因此，它的贡献更像“结构位置和系统组合创新”，而不是基础算子创新。

## 我的看法：不如 FoundIR-v2 有启发，但做得完整

如果只看模块设计和实验结果，UniLDiff 是一篇完成度很高的工作。DAFF 与 DAEM 分别对应 LDM 的条件错配和细节损失，两个模块不是随意堆叠。

但从研究问题的普适性来看，我仍然更喜欢 FoundIR-v2。FoundIR-v2 讨论的是多任务基础模型如何分配数据资源与参数资源，问题更宏观，也更容易迁移到其他多任务学习场景。UniLDiff 则更依赖 SDXL、VAE 和扩散轨迹，偏向针对具体架构的模块优化。

所以我对 UniLDiff 的最终评价是：

> 它没有发明动态融合或 MoE，真正的贡献是针对 Latent Diffusion 的时间条件错配和 VAE 细节损失，把两个已有思想放到了正确的位置。研究立意不如 FoundIR-v2 开阔，但结构闭环、消融充分，因此仍是一篇合格而完整的 CVPR 工作。

原论文：[UniLDiff: Unlocking the Power of Diffusion Priors for All-in-One Image Restoration](https://arxiv.org/abs/2507.23685)  
CVPR 版本：[CVPR 2026 Open Access](https://openaccess.thecvf.com/content/CVPR2026/html/Cheng_UniLDiff_Unlocking_the_Power_of_Diffusion_Priors_for_All-in-One_Image_CVPR_2026_paper.html)
